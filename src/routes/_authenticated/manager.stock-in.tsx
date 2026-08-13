import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { formatDate, formatCurrency } from "@/lib/format";
import { ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/manager/stock-in")({
  component: StockInRecordsPage,
});
function StockInRecordsPage() {
  const records = useQuery({
    queryKey: ["stock-in-records"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, details, created_at")
        .eq("action", "stock_in")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });
  return (
    <div className="p-6 md:p-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <ClipboardList className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock-In Records</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record and review every delivery, quantity, and buying cost.
          </p>
        </div>
      </header>
      <Card className="p-5">
        <div className="divide-y divide-border">
          {records.data?.map((record: any) => (
            <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <div className="font-medium">
                  {record.details?.product_name ?? "Stock received"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(record.created_at)} · {record.details?.reason ?? "Manual stock-in"}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">+{record.details?.quantity ?? 0} units</div>
                <div className="text-xs text-muted-foreground">
                  Buying cost {formatCurrency(record.details?.buying_price ?? 0)}
                </div>
              </div>
            </div>
          ))}
          {!records.data?.length && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No stock-in records yet. Add stock from the Stock page.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
