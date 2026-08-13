import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
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
  managerName: string;
  managerTitle: string;
  cashierName: string;
  cashierTitle: string;
};

const defaults: SettingsForm = {
  shopName: "Green Shop",
  currency: "USD",
  taxRate: "0",
  lowStockDefault: "5",
  managerName: "Mr Pride Tatire",
  managerTitle: "Manager",
  cashierName: "Cashier",
  cashierTitle: "Cashier",
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
  const [storage, setStorage] = useState({ usage: 0, quota: 0 });
  useEffect(() => {
    void navigator.storage
      ?.estimate()
      .then(({ usage = 0, quota = 0 }) => setStorage({ usage, quota }));
  }, []);

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
      window.dispatchEvent(
        new StorageEvent("storage", { key: SETTINGS_KEY, newValue: JSON.stringify(form) }),
      );
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
      <Card className="mb-6 max-w-2xl p-6">
        <h2 className="font-semibold">Online database storage monitor</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This device&apos;s cached application storage used for offline checkout.
        </p>
        <Progress
          className="mt-4"
          value={storage.quota ? Math.min(100, (storage.usage / storage.quota) * 100) : 0}
        />
        <div className="mt-2 text-xs text-muted-foreground">
          {storage.quota
            ? `${(storage.usage / 1048576).toFixed(1)} MB used of ${(storage.quota / 1048576).toFixed(1)} MB available`
            : "Storage estimate unavailable"}
        </div>
      </Card>
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
          <div className="border-t border-border pt-4 sm:col-span-2">
            <h2 className="font-semibold">Role identities</h2>
            <p className="text-sm text-muted-foreground">
              These names and titles appear across the manager and cashier workspaces.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="managerName">Manager name</Label>
            <Input
              id="managerName"
              value={form.managerName}
              onChange={(e) => update("managerName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="managerTitle">Manager title</Label>
            <Input
              id="managerTitle"
              value={form.managerTitle}
              onChange={(e) => update("managerTitle", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cashierName">Cashier name</Label>
            <Input
              id="cashierName"
              value={form.cashierName}
              onChange={(e) => update("cashierName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cashierTitle">Cashier title</Label>
            <Input
              id="cashierTitle"
              value={form.cashierTitle}
              onChange={(e) => update("cashierTitle", e.target.value)}
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
