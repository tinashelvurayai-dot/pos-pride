// Durable local transaction log: every sale (online or queued offline) is recorded
// here first, so nothing is ever lost even if the network or the database fails.
import { IDB_KEYS, idbGet, idbSet } from "@/lib/offline-db";

const LOG_KEY = "tillpoint.transaction-log.v1";
const IDB_LOG_KEY = "transaction-log";

export type TxLogItem = {
  name: string;
  variant: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type TxLogEntry = {
  id: string;
  created_at: string;
  total: number;
  payment_type: string;
  cashier_name: string;
  items: TxLogItem[];
  status: "synced" | "queued" | "failed";
};

type Listener = (list: TxLogEntry[]) => void;
const listeners = new Set<Listener>();

export function subscribeLog(fn: Listener): () => void {
  listeners.add(fn);
  fn(readLog());
  return () => listeners.delete(fn);
}

function notify(list: TxLogEntry[]) {
  for (const fn of listeners) {
    try { fn(list); } catch { /* noop */ }
  }
}

export function readLog(): TxLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as TxLogEntry[]) : [];
  } catch {
    return [];
  }
}

function writeLog(list: TxLogEntry[]) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(list)); } catch { /* noop */ }
  void idbSet(IDB_LOG_KEY, list);
  notify(list);
}

/** Restore from IndexedDB if localStorage was cleared by the browser. */
export async function hydrateLogFromIdb(): Promise<TxLogEntry[]> {
  const local = readLog();
  const durable = (await idbGet<TxLogEntry[]>(IDB_LOG_KEY)) ?? [];
  const byId = new Map<string, TxLogEntry>();
  for (const e of [...durable, ...local]) byId.set(e.id, e);
  const merged = [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (merged.length !== local.length) writeLog(merged);
  else notify(merged);
  return merged;
}

export function appendLog(entry: Omit<TxLogEntry, "id" | "created_at"> & { id?: string; created_at?: string }): TxLogEntry {
  const full: TxLogEntry = {
    id: entry.id ?? (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`),
    created_at: entry.created_at ?? new Date().toISOString(),
    total: entry.total,
    payment_type: entry.payment_type,
    cashier_name: entry.cashier_name,
    items: entry.items,
    status: entry.status,
  };
  writeLog([full, ...readLog()]);
  return full;
}

export function markLogStatus(id: string, status: TxLogEntry["status"]) {
  writeLog(readLog().map((e) => (e.id === id ? { ...e, status } : e)));
}

export function clearLog() {
  writeLog([]);
}

export function logToCsv(list: TxLogEntry[]): string {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["When", "Cashier", "Payment", "Status", "Item", "Variant", "Qty", "Unit price", "Line total", "Sale total"];
  const rows: string[] = [header.join(",")];
  for (const e of list) {
    for (const i of e.items) {
      rows.push([
        new Date(e.created_at).toISOString(),
        e.cashier_name,
        e.payment_type,
        e.status,
        i.name,
        i.variant,
        i.quantity,
        i.unit_price.toFixed(2),
        i.subtotal.toFixed(2),
        e.total.toFixed(2),
      ].map(esc).join(","));
    }
  }
  return rows.join("\n");
}

export { IDB_KEYS };
