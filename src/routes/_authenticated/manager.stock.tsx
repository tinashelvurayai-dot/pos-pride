import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { AlertTriangle, TrendingDown, Boxes, DollarSign, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/manager/stock")({
  component: StockPage,
});

type StockRow = {
  id: string;
  quantity: number;
  low_stock_alert_level: number;
  variant: {
    id: string;
    variant_name: string;
    size: string | null;
    price: number;
    product: { name: string; category: string | null } | null;
  } | null;
};

function StockPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "low" | "out" | "ok">("all");
  const [addStockFor, setAddStockFor] = useState<StockRow | null>(null);
  const [editPriceFor, setEditPriceFor] = useState<StockRow | null>(null);

  const stock = useQuery({
    queryKey: ["stock", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock")
        .select("id, quantity, low_stock_alert_level, variant:product_variants(id, variant_name, size, price, product:products(name, category))")
        .order("quantity");
      if (error) throw error;
      return data as unknown as StockRow[];
    },
  });

  const updateStock = useMutation({
    mutationFn: async ({ id, quantity, low }: { id: string; quantity: number; low: number }) => {
      const { error } = await supabase.from("stock").update({ quantity, low_stock_alert_level: low }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stock updated");
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addStock = useMutation({
    mutationFn: async ({ id, current, add }: { id: string; current: number; add: number }) => {
      const { error } = await supabase.from("stock").update({ quantity: current + add }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stock added");
      qc.invalidateQueries({ queryKey: ["stock"] });
      setAddStockFor(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePrice = useMutation({
    mutationFn: async ({ variant_id, price }: { variant_id: string; price: number }) => {
      const { error } = await supabase.from("product_variants").update({ price }).eq("id", variant_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Price updated");
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setEditPriceFor(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = stock.data ?? [];

  const stats = useMemo(() => {
    const totalUnits = rows.reduce((s, r) => s + r.quantity, 0);
    const inventoryValue = rows.reduce((s, r) => s + r.quantity * Number(r.variant?.price ?? 0), 0);
    const out = rows.filter((r) => r.quantity === 0).length;
    const low = rows.filter((r) => r.quantity > 0 && r.quantity <= r.low_stock_alert_level).length;
    return { totalUnits, inventoryValue, out, low, skus: rows.length };
  }, [rows]);

  const filtered = rows.filter((r) => {
    const q = filter.toLowerCase();
    const matchQ = !q || r.variant?.variant_name.toLowerCase().includes(q) || r.variant?.product?.name.toLowerCase().includes(q);
    const status = r.quantity === 0 ? "out" : r.quantity <= r.low_stock_alert_level ? "low" : "ok";
    const matchS = statusFilter === "all" || status === statusFilter;
    return matchQ && matchS;
  });

  return (
    <div className="p-4 sm:p-6 md:p-10">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Stock control</h1>
        <p className="mt-1 text-sm text-muted-foreground">Smart inventory monitoring, restock, and price adjustments.</p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<Boxes className="h-5 w-5 text-blue-600" />} label="SKUs" value={stats.skus.toString()} tone="blue" />
        <StatCard icon={<Boxes className="h-5 w-5 text-slate-600" />} label="Units on hand" value={stats.totalUnits.toLocaleString()} tone="slate" />
        <StatCard icon={<DollarSign className="h-5 w-5 text-emerald-600" />} label="Inventory value" value={formatCurrency(stats.inventoryValue)} tone="emerald" />
        <StatCard icon={<AlertTriangle className="h-5 w-5 text-amber-600" />} label="Low / Out" value={`${stats.low} / ${stats.out}`} tone="amber" />
      </div>

      {(stats.low > 0 || stats.out > 0) && (
        <Card className="mb-6 border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <TrendingDown className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="text-sm text-amber-900">
              <div className="font-semibold">Smart alert</div>
              <div>
                {stats.out > 0 && <>{stats.out} item{stats.out === 1 ? "" : "s"} out of stock. </>}
                {stats.low > 0 && <>{stats.low} running low. </>}
                Consider restocking before your next busy day.
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          <Input placeholder="Search product or variant..." value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm" />
          <div className="flex gap-1">
            {(["all", "ok", "low", "out"] as const).map((s) => (
              <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)}>
                {s === "all" ? "All" : s === "ok" ? "In stock" : s === "low" ? "Low" : "Out"}
              </Button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Low alert</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No stock matches.</TableCell></TableRow>
              ) : filtered.map((r) => (
                <StockEditor
                  key={r.id}
                  row={r}
                  onSave={(q, l) => updateStock.mutate({ id: r.id, quantity: q, low: l })}
                  onAdd={() => setAddStockFor(r)}
                  onEditPrice={() => setEditPriceFor(r)}
                  pending={updateStock.isPending}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!addStockFor} onOpenChange={(o) => !o && setAddStockFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add stock - {addStockFor?.variant?.product?.name}</DialogTitle></DialogHeader>
          {addStockFor && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const add = parseInt(String(fd.get("add") ?? "0"), 10) || 0;
                if (add > 0) addStock.mutate({ id: addStockFor.id, current: addStockFor.quantity, add });
              }}
              className="space-y-4"
            >
              <div className="text-sm text-muted-foreground">Current: <span className="font-medium text-foreground">{addStockFor.quantity}</span></div>
              <div className="space-y-2"><Label>Units to add</Label><Input name="add" type="number" min="1" required autoFocus /></div>
              <DialogFooter><Button type="submit" disabled={addStock.isPending}>Add to stock</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editPriceFor} onOpenChange={(o) => !o && setEditPriceFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit price - {editPriceFor?.variant?.variant_name}</DialogTitle></DialogHeader>
          {editPriceFor?.variant && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const price = parseFloat(String(fd.get("price") ?? "0"));
                if (price >= 0) updatePrice.mutate({ variant_id: editPriceFor.variant!.id, price });
              }}
              className="space-y-4"
            >
              <div className="space-y-2"><Label>New price</Label><Input name="price" type="number" step="0.01" min="0" defaultValue={Number(editPriceFor.variant.price)} required autoFocus /></div>
              <DialogFooter><Button type="submit" disabled={updatePrice.isPending}>Save</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "blue" | "slate" | "emerald" | "amber" }) {
  const bg = {
    blue: "bg-blue-50 border-blue-200",
    slate: "bg-slate-50 border-slate-200",
    emerald: "bg-emerald-50 border-emerald-200",
    amber: "bg-amber-50 border-amber-200",
  }[tone];
  return (
    <Card className={`border p-4 ${bg}`}>
      <div className="flex items-center gap-2 text-xs font-medium text-slate-600">{icon}<span>{label}</span></div>
      <div className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">{value}</div>
    </Card>
  );
}

function StockEditor({ row, onSave, onAdd, onEditPrice, pending }: { row: StockRow; onSave: (q: number, l: number) => void; onAdd: () => void; onEditPrice: () => void; pending: boolean }) {
  const [q, setQ] = useState(row.quantity);
  const [l, setL] = useState(row.low_stock_alert_level);
  const dirty = q !== row.quantity || l !== row.low_stock_alert_level;
  const status = q === 0 ? "out" : q <= l ? "low" : "ok";
  const value = q * Number(row.variant?.price ?? 0);
  return (
    <TableRow>
      <TableCell className="font-medium">{row.variant?.product?.name}</TableCell>
      <TableCell>
        <div>{row.variant?.variant_name}</div>
        <div className="text-xs text-muted-foreground">{row.variant?.size}</div>
      </TableCell>
      <TableCell>
        <button onClick={onEditPrice} className="inline-flex items-center gap-1 rounded px-1 hover:bg-blue-50 hover:text-blue-700">
          {formatCurrency(row.variant?.price ?? 0)}
        </button>
      </TableCell>
      <TableCell><Input type="number" min={0} value={q} onChange={(e) => setQ(Number(e.target.value) || 0)} className="w-20" /></TableCell>
      <TableCell><Input type="number" min={0} value={l} onChange={(e) => setL(Number(e.target.value) || 0)} className="w-20" /></TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatCurrency(value)}</TableCell>
      <TableCell>
        {status === "out" ? <Badge variant="destructive">Out</Badge> : status === "low" ? <Badge className="bg-amber-500 text-white">Low</Badge> : <Badge variant="secondary">OK</Badge>}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={onAdd}><Plus className="h-3.5 w-3.5" /></Button>
          <Button size="sm" disabled={!dirty || pending} onClick={() => onSave(q, l)}>Save</Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
