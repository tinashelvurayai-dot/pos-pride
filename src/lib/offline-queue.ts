// Offline sales queue.
// Writes go to localStorage (synchronous, instantly readable by the UI) and are
// mirrored into IndexedDB for durability. On boot we hydrate from IndexedDB in
// case localStorage was cleared by the browser.
import { supabase } from "@/integrations/supabase/client";
import { IDB_KEYS, idbGet, idbSet } from "@/lib/offline-db";
import { markLogStatus } from "@/lib/transaction-log";


const QUEUE_KEY = "tillpoint.offline-sales.v1";

export type QueuedSaleItem = {
  variant_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type QueuedSale = {
  id: string; // client-generated
  cashier_id: string;
  total_amount: number;
  payment_type: "cash" | "mobile" | "card" | "other";
  items: QueuedSaleItem[];
  queued_at: string;
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

/** Restore the queue from IndexedDB when localStorage lost it (called once at boot). */
export async function hydrateQueueFromIdb(): Promise<number> {
  const local = read();
  const durable = (await idbGet<QueuedSale[]>(IDB_KEYS.sales)) ?? [];
  const byId = new Map<string, QueuedSale>();
  for (const s of [...durable, ...local]) byId.set(s.id, s);
  const merged = [...byId.values()].sort((a, b) => a.queued_at.localeCompare(b.queued_at));
  if (merged.length !== local.length) write(merged);
  else notify(merged);
  return merged.length;
}

export function enqueueSale(sale: Omit<QueuedSale, "id" | "queued_at">): QueuedSale {
  const entry: QueuedSale = {
    ...sale,
    id: crypto.randomUUID(),
    queued_at: new Date().toISOString(),
  };
  const list = read();
  list.push(entry);
  write(list);
  return entry;
}

export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  const list = read();
  if (list.length === 0) return { ok: 0, failed: 0 };

  // Ensure we have an authenticated session so RLS (cashier_id = auth.uid()) passes.
  let { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    try {
      await supabase.auth.signInAnonymously({ options: { data: { full_name: "Guest Cashier" } } });
      ({ data: sessionData } = await supabase.auth.getSession());
    } catch {
      return { ok: 0, failed: list.length };
    }
  }
  const uid = sessionData.session?.user.id;
  if (!uid) return { ok: 0, failed: list.length };

  let ok = 0;
  const remaining: QueuedSale[] = [];
  for (const q of list) {
    try {
      const { data: sale, error: saleErr } = await supabase
        .from("sales")
        .insert({
          cashier_id: uid,
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
      markLogStatus(q.id, "synced");
      ok++;
    } catch {
      remaining.push(q);

    }
  }
  write(remaining);
  return { ok, failed: remaining.length };
}
