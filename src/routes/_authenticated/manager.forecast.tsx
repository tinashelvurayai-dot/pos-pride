import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { forecastStock } from "@/lib/forecast.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertTriangle, Clock, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/manager/forecast")({
  component: ForecastPage,
});

function ForecastPage() {
  const run = useServerFn(forecastStock);
  const q = useQuery({
    queryKey: ["forecast"],
    queryFn: () => run(),
    staleTime: 5 * 60 * 1000,
  });

  const rows = q.data?.rows ?? [];
  const critical = rows.filter((r) => r.daysLeft <= 3 && r.perDay > 0);
  const warning = rows.filter((r) => r.daysLeft > 3 && r.daysLeft <= 7 && r.perDay > 0);

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Sparkles className="h-7 w-7 text-blue-600" />
          AI Sales Forecast
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Predicts when each product will run out based on the last 30 days of sales. Reruns automatically.
        </p>
      </header>

      {q.isLoading && <Card className="border-blue-100 p-6">Analyzing sales patterns…</Card>}
      {q.isError && <Card className="border-destructive/40 p-6 text-destructive">Failed to run forecast: {(q.error as Error).message}</Card>}

      {q.data && (
        <>
          {q.data.insight && (
            <Card className="mb-6 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-900">
                <Sparkles className="h-4 w-4" /> AI insight
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{q.data.insight}</div>
            </Card>
          )}

          <section className="grid gap-4 md:grid-cols-3">
            <Card className="border-red-200 bg-red-50 p-5">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-red-900">
                <AlertTriangle className="h-4 w-4" /> Critical (≤3 days)
              </div>
              <div className="text-3xl font-bold text-red-900">{critical.length}</div>
            </Card>
            <Card className="border-amber-200 bg-amber-50 p-5">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-amber-900">
                <Clock className="h-4 w-4" /> Warning (4-7 days)
              </div>
              <div className="text-3xl font-bold text-amber-900">{warning.length}</div>
            </Card>
            <Card className="border-blue-200 bg-blue-50 p-5">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-blue-900">
                <TrendingUp className="h-4 w-4" /> Tracked SKUs
              </div>
              <div className="text-3xl font-bold text-blue-900">{rows.length}</div>
            </Card>
          </section>

          <Card className="mt-6 border-blue-100 p-5">
            <h2 className="mb-4 font-semibold">Runout forecast</h2>
            <ul className="divide-y divide-blue-100">
              {rows.slice(0, 30).map((r) => (
                <li key={r.key} className="grid grid-cols-[1fr_auto] items-center gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.stock} in stock · sold {r.sold30} in 30 days · ~{r.perDay.toFixed(1)}/day
                    </div>
                  </div>
                  <div>
                    {r.perDay === 0 ? (
                      <Badge variant="outline">No recent sales</Badge>
                    ) : r.daysLeft <= 3 ? (
                      <Badge variant="destructive">Runs out in ~{r.daysLeft.toFixed(1)} days</Badge>
                    ) : r.daysLeft <= 7 ? (
                      <Badge className="bg-amber-500 text-white">~{r.daysLeft.toFixed(1)} days left</Badge>
                    ) : (
                      <Badge variant="outline" className="border-blue-300 text-blue-700">~{r.daysLeft.toFixed(0)} days</Badge>
                    )}
                  </div>
                </li>
              ))}
              {rows.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No data yet - record some sales first.</li>}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
