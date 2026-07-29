// Offline sales queue: persists checkouts to localStorage and flushes them when back online.
import { supabase } from "@/integrations/supabase/client";

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
}

export function getQueue(): QueuedSale[] {
  return read();
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
      ok++;
    } catch {
      remaining.push(q);
    }
  }
  write(remaining);
  return { ok, failed: remaining.length };
}
