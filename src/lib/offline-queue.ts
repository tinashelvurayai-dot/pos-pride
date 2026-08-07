// Offline sales queue.
// Writes go to localStorage (synchronous, instantly readable by the UI) and are
// mirrored into IndexedDB for durability. On boot we hydrate from IndexedDB in
// case localStorage was cleared by the browser.
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
  id: string; // client-generated UUID, also used as the server idempotency key
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

export function subscribeQueue(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(list: QueuedSale[]) {
  for (const fn of listeners) {
    try { fn(list.length); } catch { /* noop */ }
  }
}

function read(): QueuedSale[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedSale[]) : [];
  } catch {
    return [];
  }
}
function write(list: QueuedSale[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(list)); } catch { /* noop */ }
  void idbSet(IDB_KEYS.sales, list);
  notify(list);
}

export function getQueue(): QueuedSale[] {
  return read();
}

function patch(id: string, changes: Partial<QueuedSale>) {
  write(read().map((s) => (s.id === id ? { ...s, ...changes } : s)));
}

/** Restore the queue from IndexedDB when localStorage lost it (called once at boot). */
export async function hydrateQueueFromIdb(): Promise<number> {
  const local = read();
  const durable = (await idbGet<QueuedSale[]>(IDB_KEYS.sales)) ?? [];
  const byId = new Map<string, QueuedSale>();
  for (const s of [...durable, ...local]) byId.set(s.id, s);
  const merged = [...byId.values()]
    .map((s) => (s.status === "uploading" ? { ...s, status: "pending" as const } : s))
    .sort((a, b) => a.queued_at.localeCompare(b.queued_at));
  write(merged);
  return merged.length;
}

export function enqueueSale(sale: Omit<QueuedSale, "id" | "queued_at"> & { id?: string }): QueuedSale {
  const entry: QueuedSale = {
    ...sale,
    id: sale.id ?? crypto.randomUUID(),
    queued_at: new Date().toISOString(),
    status: "pending",
    attempts: 0,
  };
  const list = read();
  list.push(entry);
  write(list);
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
    // client_id is a unique idempotency key: a retried upload can never
    // create a second copy of the same sale.
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

    // Confirmed on the server -> only now drop the local copies.
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

/** Retry a single failed/pending sale on demand. */
export async function retrySale(id: string): Promise<boolean> {
  const q = read().find((s) => s.id === id);
  if (!q) return false;
  const uid = await ensureSession();
  if (!uid) return false;
  const ok = await uploadSale(q, uid);
  if (ok) write(read().filter((s) => s.id !== id));
  return ok;
}

export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  const list = read();
  if (list.length === 0) return { ok: 0, failed: 0 };

  // Ensure we have an authenticated session so RLS (cashier_id = auth.uid()) passes.
  const uid = await ensureSession();
  if (!uid) return { ok: 0, failed: list.length };

  let ok = 0;
  const uploaded = new Set<string>();
  for (const q of list) {
    const success = await uploadSale(q, uid);
    if (success) { uploaded.add(q.id); ok++; }
  }

  const remaining = read().filter((s) => !uploaded.has(s.id));
  write(remaining);
  return { ok, failed: remaining.length };
}
