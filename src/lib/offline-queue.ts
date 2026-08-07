// Offline sales queue.
// The in-memory cache is the checkout source of truth: local persistence is
// mirrored without ever being allowed to delay a completed sale.
import { supabase } from "@/integrations/supabase/client";
import { IDB_KEYS, idbGet, idbSet } from "@/lib/offline-db";
import { markLogStatus } from "@/lib/transaction-log";
import { clearSaleDelta } from "@/lib/local-stock";

const QUEUE_KEY = "tillpoint.offline-sales.v1";

export type QueuedSaleItem = {
  variant_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type QueueStatus = "pending" | "uploading" | "failed";

export type QueuedSale = {
  id: string;
  cashier_id: string;
  cashier_name?: string;
  total_amount: number;
  payment_type: "cash" | "mobile" | "card" | "other";
  items: QueuedSaleItem[];
  queued_at: string;
  status?: QueueStatus;
  attempts?: number;
  last_error?: string;
};

type Listener = (count: number) => void;
const listeners = new Set<Listener>();

function readStorage(): QueuedSale[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedSale[]) : [];
  } catch {
    return [];
  }
}

let queueCache = readStorage();

export function subscribeQueue(fn: Listener): () => void {
  listeners.add(fn);
  fn(queueCache.length);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) {
    try {
      fn(queueCache.length);
    } catch {
      /* noop */
    }
  }
}

function persist(list: QueuedSale[]) {
  queueCache = list;
  // Keep only a small synchronous mirror. Serializing thousands of sales into
  // localStorage was blocking the cashier and leaving the button on “Saving”.
  // IndexedDB remains the durable source for the complete queue.
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    /* best effort */
  }
  void idbSet(IDB_KEYS.sales, list);
  notify();
}

export function getQueue(): QueuedSale[] {
  return queueCache.slice();
}

function patch(id: string, changes: Partial<QueuedSale>) {
  persist(queueCache.map((s) => (s.id === id ? { ...s, ...changes } : s)));
}

/** Restore IndexedDB data without blocking the checkout path. */
export async function hydrateQueueFromIdb(): Promise<number> {
  const durable = (await idbGet<QueuedSale[]>(IDB_KEYS.sales)) ?? [];
  const byId = new Map<string, QueuedSale>();
  // Merge against the latest cache after IndexedDB resolves so a sale entered
  // while hydration is in flight can never be overwritten by stale data.
  for (const s of [...durable, ...queueCache]) byId.set(s.id, s);
  const merged = [...byId.values()]
    .map((s) => (s.status === "uploading" ? { ...s, status: "pending" as const } : s))
    .sort((a, b) => a.queued_at.localeCompare(b.queued_at));
  persist(merged);
  return merged.length;
}

export function enqueueSale(
  sale: Omit<QueuedSale, "id" | "queued_at"> & { id?: string },
): QueuedSale {
  const entry: QueuedSale = {
    ...sale,
    id: sale.id ?? crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    queued_at: new Date().toISOString(),
    status: "pending",
    attempts: 0,
  };
  persist([...queueCache, entry]);
  return entry;
}

async function ensureSession(): Promise<string | null> {
  let { data } = await supabase.auth.getSession();
  if (!data.session) {
    try {
      await supabase.auth.signInAnonymously({ options: { data: { full_name: "Guest Cashier" } } });
      ({ data } = await supabase.auth.getSession());
    } catch {
      return null;
    }
  }
  return data.session?.user.id ?? null;
}

/** Upload one queued sale. Returns true when the server confirms it. */
export async function uploadSale(q: QueuedSale, uid: string): Promise<boolean> {
  try {
    patch(q.id, { status: "uploading" });
    const { data: existing } = await supabase
      .from("sales")
      .select("id")
      .eq("client_id", q.id)
      .maybeSingle();

    if (!existing?.id) {
      const { data: sale, error: saleErr } = await supabase
        .from("sales")
        .insert({
          cashier_id: uid,
          cashier_name: q.cashier_name ?? "Cashier",
          client_id: q.id,
          total_amount: q.total_amount,
          payment_type: q.payment_type,
          created_at: q.queued_at,
        })
        .select("id")
        .single();
      if (saleErr) throw saleErr;
      const items = q.items.map((i) => ({ ...i, sale_id: sale.id }));
      const { error: itemsErr } = await supabase.from("sale_items").insert(items);
      if (itemsErr) throw itemsErr;
    }

    markLogStatus(q.id, "synced");
    clearSaleDelta(q.id);
    return true;
  } catch (e) {
    patch(q.id, {
      status: "failed",
      attempts: (q.attempts ?? 0) + 1,
      last_error: e instanceof Error ? e.message : "Upload failed",
    });
    markLogStatus(q.id, "queued");
    return false;
  }
}

export async function retrySale(id: string): Promise<boolean> {
  const q = queueCache.find((s) => s.id === id);
  if (!q) return false;
  const uid = await ensureSession();
  if (!uid) return false;
  const ok = await uploadSale(q, uid);
  if (ok) persist(queueCache.filter((s) => s.id !== id));
  return ok;
}

export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  const list = queueCache.slice();
  if (list.length === 0) return { ok: 0, failed: 0 };
  const uid = await ensureSession();
  if (!uid) return { ok: 0, failed: list.length };

  let ok = 0;
  const uploaded = new Set<string>();
  for (const q of list) {
    if (await uploadSale(q, uid)) {
      uploaded.add(q.id);
      ok++;
    }
  }
  persist(queueCache.filter((s) => !uploaded.has(s.id)));
  return { ok, failed: queueCache.length };
}
