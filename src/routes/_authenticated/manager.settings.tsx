import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/manager/settings")({
  component: ManagerSettingsPage,
});

const SETTINGS_KEY = "tillpoint.manager.settings.v1";

type SettingsForm = {
  shopName: string;
  currency: string;
  taxRate: string;
  lowStockDefault: string;
};

const defaults: SettingsForm = {
  shopName: "Green Shop",
  currency: "USD",
  taxRate: "0",
  lowStockDefault: "5",
};

function readSettings(): SettingsForm {
  try {
    return {
      ...defaults,
      ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<SettingsForm>),
    };
  } catch {
    return defaults;
  }
}

function ManagerSettingsPage() {
  const { profile } = useAuth();
  const [form, setForm] = useState<SettingsForm>(defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(readSettings()), []);

  function update<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const taxRate = Number(form.taxRate);
    const lowStockDefault = Number(form.lowStockDefault);
    if (!form.shopName.trim() || !form.currency.trim() || taxRate < 0 || lowStockDefault < 0) {
      toast.error("Check the settings values and try again.");
      return;
    }
    setSaving(true);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(form));
      if (profile?.id) {
        await supabase
          .from("profiles")
          .update({ full_name: profile.full_name })
          .eq("id", profile.id);
      }
      toast.success("Manager settings saved on this device.");
    } catch {
      toast.error("Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8 flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manager settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure the local checkout defaults for this shop.
          </p>
        </div>
      </header>
      <Card className="max-w-2xl p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="shopName">Shop name</Label>
            <Input
              id="shopName"
              value={form.shopName}
              onChange={(e) => update("shopName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={form.currency}
              onChange={(e) => update("currency", e.target.value.toUpperCase())}
              maxLength={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxRate">Tax rate (%)</Label>
            <Input
              id="taxRate"
              type="number"
              min="0"
              step="0.01"
              value={form.taxRate}
              onChange={(e) => update("taxRate", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lowStockDefault">Default low-stock threshold</Label>
            <Input
              id="lowStockDefault"
              type="number"
              min="0"
              value={form.lowStockDefault}
              onChange={(e) => update("lowStockDefault", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => void save()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save settings"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
