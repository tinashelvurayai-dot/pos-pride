// Offline stock decrement.
// Every sale made on this device reduces a local delta immediately, so on-hand
// counts stay correct while offline. When a queued sale finally syncs, the
// server decrements the real stock and the local delta for that sale is dropped.
import { idbGet, idbSet } from "@/lib/offline-db";

const KEY = "tillpoint.stock-deltas.v1";
const IDB_KEY = "stock-deltas";

/** saleId -> { variantId: unitsSold } */
type DeltaMap = Record<string, Record<string, number>>;

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): DeltaMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DeltaMap) : {};
  } catch {
    return {};
  }
}

function write(map: DeltaMap) {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* noop */ }
  void idbSet(IDB_KEY, map);
  for (const fn of listeners) {
    try { fn(); } catch { /* noop */ }
  }
}

export function subscribeStockDeltas(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function hydrateStockDeltas(): Promise<void> {
  const local = read();
  if (Object.keys(local).length > 0) return;
  const durable = (await idbGet<DeltaMap>(IDB_KEY)) ?? {};
  if (Object.keys(durable).length > 0) write(durable);
}

export function recordSaleDelta(saleId: string, items: Array<{ variant_id: string; quantity: number }>) {
  const map = read();
  const entry: Record<string, number> = {};
  for (const i of items) entry[i.variant_id] = (entry[i.variant_id] ?? 0) + i.quantity;
  map[saleId] = entry;
  write(map);
}

export function clearSaleDelta(saleId: string) {
  const map = read();
  if (!(saleId in map)) return;
  delete map[saleId];
  write(map);
}

/** Total units sold locally but not yet reflected on the server, per variant. */
export function pendingDeltas(): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const entry of Object.values(read())) {
    for (const [variantId, qty] of Object.entries(entry)) {
      totals[variantId] = (totals[variantId] ?? 0) + qty;
    }
  }
  return totals;
}

export function localQuantity(variantId: string, serverQuantity: number): number {
  return serverQuantity - (pendingDeltas()[variantId] ?? 0);
}
