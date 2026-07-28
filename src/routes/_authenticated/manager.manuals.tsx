import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BookOpen, Eye, EyeOff } from "lucide-react";
import { CashierManualContent, VoiceCommandHelp } from "./cashier";

export const Route = createFileRoute("/_authenticated/manager/manuals")({
  component: ManualsPage,
});

function ManagerManualContent() {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <section>
        <h3 className="font-semibold text-base">1. Overview</h3>
        <p className="text-muted-foreground">The manager console is your full control room. Use the sidebar to move between Dashboard, Products, Stock, Staff, Sales, Daily Cash Collection, Expenses & Profit, Suppliers, Forecast, Orders, and Manuals.</p>
      </section>
      <section>
        <h3 className="font-semibold text-base">2. Dashboard</h3>
        <p className="text-muted-foreground">See today's revenue, transaction count, active product count, and low-stock alerts at a glance, plus a live feed of recent sales.</p>
      </section>
      <section>
        <h3 className="font-semibold text-base">3. Products</h3>
        <p className="text-muted-foreground">Create products with base info, take a product photo, or upload an image from the device. Each product can have multiple variants - size, flavour or colour, price, SKU, and initial stock. Managers can edit prices and details later.</p>
      </section>
      <section>
        <h3 className="font-semibold text-base">4. Stock — how it works now</h3>
        <p className="text-muted-foreground">Every product is treated as <span className="font-medium">In Stock by default</span>. Cashiers can sell any item without a quantity check. When a cashier notices an item has run out on the shelf, they press <span className="font-medium">Out of Stock</span> on that product tile — it is instantly flagged and blocked from further sales. Managers can un-flag one item with <span className="font-medium">Stock Available</span> or reset everything with <span className="font-medium">Stock Available (All)</span> after a restock.</p>
      </section>
      <section>
        <h3 className="font-semibold text-base">5. Recording new stock received</h3>
        <p className="text-muted-foreground">When a delivery arrives, open Stock, find the variant, press the <span className="font-medium">+</span> button and enter the number of <span className="font-medium">packets brought in</span>. The system adds that to the on-hand count. You do not need to count the whole shop — only what came in.</p>
      </section>
      <section>
        <h3 className="font-semibold text-base">6. Staff</h3>
        <p className="text-muted-foreground">See everyone who has access. Managers can update cashier names, IDs, details, and active status. Cashier mode opens without a password from the welcome page for shared counter devices.</p>
      </section>
      <section>
        <h3 className="font-semibold text-base">7. Sales, daily cash, expenses, and profit</h3>
        <p className="text-muted-foreground">Transaction log with cashier, payment method, item count, and total. Use <span className="font-medium">Export CSV</span> on the Sales page for accounting or backup.</p>
      </section>
      <section>
        <h3 className="font-semibold text-base">8. Suppliers, orders, and forecasting</h3>
        <p className="text-muted-foreground">Use Suppliers for purchase orders and auto-reorder, Orders for out-of-stock requests from cashiers, and AI Sales Forecast for run-out predictions based on sales velocity.</p>
      </section>
      <section>
        <h3 className="font-semibold text-base">9. Cashier manual toggle</h3>
        <p className="text-muted-foreground">On this Manuals page you can show or hide the cashier manual button inside the cashier dashboard.</p>
      </section>
      <section>
        <h3 className="font-semibold text-base">10. Offline behaviour and installation</h3>
        <p className="text-muted-foreground">Install from Chrome so the app appears alongside other device apps. Once the cashier dashboard has loaded once online, cashiers can sell fully offline — sales queue on the device and sync automatically when the connection returns.</p>
      </section>
      <section>
        <h3 className="font-semibold text-base">11. Voice commands</h3>
        <p className="text-muted-foreground">Cashier voice commands speed up checkout. The cashier dashboard has a Voice help button, and Orders has a Dictate button for restock entries.</p>
      </section>

    </div>
  );
}

function ManualsPage() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["manager", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("show_cashier_manual").eq("id", true).maybeSingle();
      if (error) throw error;
      return data ?? { show_cashier_manual: true };
    },
  });

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const { data: existing } = await supabase.from("app_settings").select("id").eq("id", true).maybeSingle();
      if (!existing) {
        const { error } = await supabase.from("app_settings").insert({ id: true, show_cashier_manual: next });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("app_settings").update({ show_cashier_manual: next, updated_at: new Date().toISOString() }).eq("id", true);
        if (error) throw error;
      }
    },
    onSuccess: (_d, next) => {
      toast.success(next ? "Cashier manual is now visible" : "Cashier manual is now hidden");
      qc.invalidateQueries({ queryKey: ["manager", "settings"] });
      qc.invalidateQueries({ queryKey: ["cashier", "settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enabled = settings.data?.show_cashier_manual !== false;

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">User manuals</h1>
        <p className="mt-1 text-sm text-muted-foreground">Reference guides for every role, and controls for what your cashiers see.</p>
      </header>

      <Card className="mb-8 p-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              {enabled ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              Show cashier manual inside the cashier dashboard
            </div>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              When on, cashiers see a Manual button in the top bar of their dashboard that opens a step-by-step guide. Turn off to keep the cashier screen focused on selling only.
            </p>
          </div>
          <Switch checked={enabled} disabled={toggle.isPending || settings.isLoading} onCheckedChange={(v) => toggle.mutate(v)} />
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Read the manuals</h2>
        </div>
        <Tabs defaultValue="manager">
          <TabsList>
            <TabsTrigger value="manager">Manager manual</TabsTrigger>
            <TabsTrigger value="cashier">Cashier manual</TabsTrigger>
            <TabsTrigger value="voice">Voice commands</TabsTrigger>
          </TabsList>
          <TabsContent value="manager" className="mt-6">
            <ManagerManualContent />
          </TabsContent>
          <TabsContent value="cashier" className="mt-6">
            <CashierManualContent />
          </TabsContent>
          <TabsContent value="voice" className="mt-6">
            <VoiceCommandHelp />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
