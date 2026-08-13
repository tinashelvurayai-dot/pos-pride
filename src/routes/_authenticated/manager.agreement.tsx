import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, Download, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/manager/agreement")({
  component: AgreementPage,
});
const KEY = "tillpoint.handover.agreement.v1";
const initial = {
  clientName: "",
  clientDetails: "",
  appUrl: window.location.origin,
  systemName: "TillPoint Retail OS",
  totalFee: "$170 USD",
  handoverPayment: "",
  outstandingPayment: "",
  developerOne: "",
  developerTwo: "",
  clientSigner: "",
  description:
    "A dual-role retail point-of-sale system for product, variant, stock, cashier, sales, orders, expenses, reporting, offline checkout, synchronization, and operational handover.",
  features:
    "Manager dashboard and cashier dashboard\nProduct and variant management\nStock, low-stock alerts, and Stock-In Records\nOffline checkout with queued synchronization\nSales, transaction search, exports, and storage monitoring\nOrders, suppliers, expenses, profit, manuals, and role settings",
};
function readAgreement() {
  try {
    return { ...initial, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return initial;
  }
}
function AgreementPage() {
  const [form, setForm] = useState(readAgreement);
  const update = (key: keyof typeof initial, value: string) =>
    setForm((current: typeof initial) => ({ ...current, [key]: value }));
  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(form));
    toast.success("Agreement draft saved on this device.");
  };
  const download = () => {
    const body = `POS SOFTWARE DEVELOPMENT, HANDOVER & ACCEPTANCE AGREEMENT\n\nSystem: ${form.systemName}\nClient: ${form.clientName}\nClient details: ${form.clientDetails}\nApp URL: ${form.appUrl}\n\nDESCRIPTION\n${form.description}\n\nDELIVERED FEATURES\n${form.features}\n\nFEES\nTotal development fee: ${form.totalFee}\nHandover payment: ${form.handoverPayment}\nOutstanding payment due within three days: ${form.outstandingPayment}\n\nACCEPTANCE\nThe client acknowledges receipt of the system, documentation, operational workflows, and handover information described above, subject to the terms agreed by the parties.\n\nSIGNATURES\nDeveloper 1: ${form.developerOne}\nDeveloper 2: ${form.developerTwo}\nClient: ${form.clientSigner}\nDate: ${new Date().toLocaleDateString()}`;
    const blob = new Blob([body], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "POS-Software-Development-Handover-Agreement.doc";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="p-6 md:p-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          POS Software Development, Handover & Acceptance Agreement
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Editable professional handover document. Save changes before downloading.
        </p>
      </header>
      <Card className="max-w-4xl p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label>Client name</Label>
            <Input value={form.clientName} onChange={(e) => update("clientName", e.target.value)} />
          </div>
          <div>
            <Label>Client details</Label>
            <Input
              value={form.clientDetails}
              onChange={(e) => update("clientDetails", e.target.value)}
            />
          </div>
          <div>
            <Label>System name</Label>
            <Input value={form.systemName} onChange={(e) => update("systemName", e.target.value)} />
          </div>
          <div>
            <Label>App URL</Label>
            <Input value={form.appUrl} onChange={(e) => update("appUrl", e.target.value)} />
          </div>
          <div>
            <Label>Total development fee</Label>
            <Input value={form.totalFee} onChange={(e) => update("totalFee", e.target.value)} />
          </div>
          <div>
            <Label>Handover payment</Label>
            <Input
              value={form.handoverPayment}
              onChange={(e) => update("handoverPayment", e.target.value)}
            />
          </div>
          <div>
            <Label>Three-day outstanding payment</Label>
            <Input
              value={form.outstandingPayment}
              onChange={(e) => update("outstandingPayment", e.target.value)}
            />
          </div>
          <div>
            <Label>Developer 1 signature</Label>
            <Input
              value={form.developerOne}
              onChange={(e) => update("developerOne", e.target.value)}
            />
          </div>
          <div>
            <Label>Developer 2 signature</Label>
            <Input
              value={form.developerTwo}
              onChange={(e) => update("developerTwo", e.target.value)}
            />
          </div>
          <div>
            <Label>Client signature</Label>
            <Input
              value={form.clientSigner}
              onChange={(e) => update("clientSigner", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>System description</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Features</Label>
            <Textarea
              rows={8}
              value={form.features}
              onChange={(e) => update("features", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={save}>
            <Save className="mr-2 h-4 w-4" /> Save draft
          </Button>
          <Button onClick={download}>
            <Download className="mr-2 h-4 w-4" /> Download document
          </Button>
        </div>
      </Card>
    </div>
  );
}
