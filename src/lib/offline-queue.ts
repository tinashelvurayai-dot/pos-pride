// Offline sales queue.
// IndexedDB is the primary durable store (large quota); localStorage is only a
// small synchronous mirror so the UI can read instantly on boot.
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { IDB_KEYS, idbGet, idbSet } from "@/lib/offline-db";
import { markLogStatus } from "@/lib/transaction-log";
import { clearSaleDelta } from "@/lib/local-stock";

const QUEUE_KEY = "tillpoint.offline-sales.v1";
const MAX_QUEUE = 500;
export const MAX_ATTEMPTS = 3;

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
  next_attempt_at?: string;
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
      /* a broken subscriber must never break the till */
    }
  }
}

/**
 * Persist the queue. Resolves to true when at least one store accepted the
 * write - the caller surfaces a hard error to the cashier when both fail.
 */
function persist(list: QueuedSale[]): Promise<boolean> {
  // IndexedDB holds the full queue (up to 500 sales); localStorage keeps a
  // small tail so a cold boot still shows pending work immediately.
  list = list.slice(-MAX_QUEUE);
  queueCache = list;
  notify();

  let localOk = false;
  let localError: unknown = null;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(list.slice(-50)));
    localOk = true;
  } catch (e) {
    localError = e;
  }

  return idbSet(IDB_KEYS.sales, list)
    .then(() => true)
    .catch((idbError: unknown) => {
      if (!localOk) {
        console.error("[offline-queue] both storage writes failed", { idbError, localError });
        return false;
      }
      console.warn("[offline-queue] IndexedDB write failed, localStorage mirror kept", idbError);
      return true;
    });
}

export function getQueue(): QueuedSale[] {
  return queueCache.slice();
}

function patch(id: string, changes: Partial<QueuedSale>) {
  void persist(queueCache.map((s) => (s.id === id ? { ...s, ...changes } : s)));
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
  void persist(merged);
  return merged.length;
}

export function enqueueSale(
  sale: Omit<QueuedSale, "id" | "queued_at"> & { id?: string },
): QueuedSale {
  const entry: QueuedSale = {
    ...sale,
    // Unique id + timestamp: the server dedupes on this id.
    id: sale.id ?? crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    queued_at: new Date().toISOString(),
    status: "pending",
    attempts: 0,
  };
  void persist([...queueCache, entry]).then((ok) => {
    if (ok) {
      if (typeof navigator !== "undefined" && !navigator.onLine)
        toast.success("Sale saved offline - will sync when back online");
    } else {
      toast.error("ERROR: Sale could not be saved. Please write it down manually.", {
        duration: 60_000,
      });
    }
  });
  return entry;
}

/** A sale is eligible for an automatic retry until it burns its attempts. */
export function isRetryable(s: QueuedSale): boolean {
  if ((s.attempts ?? 0) >= MAX_ATTEMPTS) return false;
  if (s.next_attempt_at && Date.now() < Date.parse(s.next_attempt_at)) return false;
  return true;
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
    const attempts = (q.attempts ?? 0) + 1;
    // Exponential backoff: 5s, 20s, 80s before the sale is parked for manual retry.
    const delay = 5_000 * 4 ** (attempts - 1);
    patch(q.id, {
      status: "failed",
      attempts,
      last_error: e instanceof Error ? e.message : "Upload failed",
      next_attempt_at: new Date(Date.now() + delay).toISOString(),
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
  // Manual retry always runs: clear the backoff window and attempt budget.
  patch(id, { attempts: 0, next_attempt_at: undefined });
  const ok = await uploadSale({ ...q, attempts: 0 }, uid);
  if (ok) void persist(queueCache.filter((s) => s.id !== id));
  return ok;
}

export async function flushQueue(): Promise<{ ok: number; failed: number; total: number }> {
  const list = queueCache.slice();
  if (list.length === 0) return { ok: 0, failed: 0, total: 0 };
  const uid = await ensureSession();
  if (!uid) return { ok: 0, failed: list.length, total: list.length };

  const due = list.filter(isRetryable);
  let ok = 0;
  const uploaded = new Set<string>();
  for (const q of due) {
    if (await uploadSale(q, uid)) {
      uploaded.add(q.id);
      ok++;
    }
  }
  void persist(queueCache.filter((s) => !uploaded.has(s.id)));
  return { ok, failed: queueCache.length, total: list.length };
}

