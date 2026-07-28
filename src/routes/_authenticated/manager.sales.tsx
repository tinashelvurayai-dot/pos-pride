import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/manager/sales")({
  component: SalesPage,
});

function toCsv(rows: any[]): string {
  const header = ["When", "Cashier", "Items", "Payment", "Total"];
  const esc = (v: any) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((s) => [
    new Date(s.created_at).toISOString(),
    s.cashier?.full_name ?? "-",
    s.items?.reduce((a: number, x: any) => a + x.quantity, 0) ?? 0,
    s.payment_type,
    Number(s.total_amount).toFixed(2),
  ].map(esc).join(","));
  return [header.join(","), ...body].join("\n");
}

function SalesPage() {
  const sales = useQuery({
    queryKey: ["sales", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, total_amount, payment_type, status, created_at, cashier:profiles!sales_cashier_id_fkey(full_name), items:sale_items(quantity)")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = (sales.data ?? []).reduce((s, r) => s + Number(r.total_amount), 0);

  function exportCsv() {
    const rows = sales.data ?? [];
    if (rows.length === 0) { toast.error("No sales to export"); return; }
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} sales`);
  }

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales</h1>
          <p className="mt-1 text-sm text-muted-foreground">Recent transactions across your shop.</p>
        </div>
        <Button onClick={exportCsv} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </header>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="p-5"><div className="text-sm text-muted-foreground">Transactions</div><div className="mt-1 text-2xl font-bold">{sales.data?.length ?? 0}</div></Card>
        <Card className="p-5"><div className="text-sm text-muted-foreground">Gross revenue</div><div className="mt-1 text-2xl font-bold">{formatCurrency(total)}</div></Card>
        <Card className="p-5"><div className="text-sm text-muted-foreground">Avg ticket</div><div className="mt-1 text-2xl font-bold">{formatCurrency(sales.data?.length ? total / sales.data.length : 0)}</div></Card>
      </div>

      <Card className="p-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Cashier</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : sales.data?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No sales yet.</TableCell></TableRow>
            ) : sales.data?.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell>{formatDate(s.created_at)}</TableCell>
                <TableCell>{s.cashier?.full_name ?? "-"}</TableCell>
                <TableCell>{s.items?.reduce((a: number, x: any) => a + x.quantity, 0) ?? 0}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{s.payment_type}</Badge></TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(s.total_amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
