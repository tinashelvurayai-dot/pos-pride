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
  scope:
    "Discovery, interface design, frontend implementation, database integration, offline workflow implementation, deployment configuration, testing, documentation, and operational handover.",
  acceptance:
    "The Client has reviewed the principal workflows, including cashier checkout, manager operations, product and stock visibility, sales records, offline queue behavior, exports, and administrative settings, and accepts the system subject to the terms of this Agreement.",
  support:
    "The Developers will provide reasonable handover clarification and defect triage for the agreed implementation. New features, material scope changes, third-party service changes, and post-acceptance enhancements are separate work unless expressly agreed in writing.",
  responsibilities:
    "The Client is responsible for accurate catalog data, authorized user access, payment settlement, Supabase/Vercel account ownership, backups and operational decisions. The Developers are responsible for delivering the agreed software scope and handover materials.",
  confidentiality:
    "Each party shall use reasonable care with non-public business, access, commercial, and technical information received from the other party.",
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
    const body = `POS SOFTWARE DEVELOPMENT, HANDOVER & ACCEPTANCE AGREEMENT\n\nEXECUTIVE RECORD\nAgreement date: ${new Date().toLocaleDateString()}\nSystem: ${form.systemName}\nApplication URL: ${form.appUrl}\nClient: ${form.clientName}\nClient details: ${form.clientDetails}\n\n1. PURPOSE AND PROJECT DESCRIPTION\n${form.description}\n\n2. AGREED SCOPE OF DELIVERY\n${form.scope}\n\n3. DELIVERED SYSTEM CAPABILITIES\n${form.features}\n\n4. HANDOVER MATERIALS\nThe handover includes the deployed application, configured user journeys, product and stock workflows, operational manuals, export workflows, relevant environment configuration held by the Client, and a walkthrough of the principal system functions.\n\n5. ACCEPTANCE CRITERIA\n${form.acceptance}\n\n6. FEES AND PAYMENT\nTotal development fee: ${form.totalFee}\nHandover payment: ${form.handoverPayment}\nOutstanding payment due within three days: ${form.outstandingPayment}\nPayment status and receipts should be retained by the parties.\n\n7. SUPPORT, DEFECTS, AND CHANGES\n${form.support}\n\n8. CLIENT RESPONSIBILITIES\n${form.responsibilities}\n\n9. CONFIDENTIALITY\n${form.confidentiality}\n\n10. ACCEPTANCE AND SIGN-OFF\nBy signing below, the parties confirm that the system has been presented for handover and that any exceptions or outstanding items have been recorded in writing.\n\nSIGNATURES\nDeveloper 1: ${form.developerOne}\nDeveloper 2: ${form.developerTwo}\nClient / Authorized Representative: ${form.clientSigner}\nDate: ${new Date().toLocaleDateString()}\n\nOutstanding notes / exceptions:\n____________________________________________________________\n____________________________________________________________\n\nThis document records a software delivery and acceptance arrangement. The parties should obtain independent legal advice where required.`;
    const blob = new Blob([body], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "POS-Software-Development-Handover-Agreement.doc";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-900 md:p-10">
      <header className="mx-auto mb-8 max-w-5xl text-white">
        <div className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">
          <FileText className="h-4 w-4" /> Executive handover record
        </div>
        <h1 className="max-w-4xl font-serif text-4xl font-semibold tracking-tight md:text-6xl">
          POS Software Development, Handover & Acceptance Agreement
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
          A detailed, editable record of delivery, operational readiness, acceptance, ownership
          responsibilities, and post-handover support.
        </p>
      </header>
      <Card className="mx-auto max-w-5xl border-amber-200/70 bg-white p-6 shadow-2xl md:p-10">
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
          <div className="sm:col-span-2 border-t border-slate-200 pt-6">
            <h2 className="font-serif text-2xl font-semibold text-slate-950">Agreement schedule</h2>
            <p className="mb-4 text-sm text-slate-500">
              Complete the commercial and operational record before signing or downloading.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label>Scope of delivery</Label>
            <Textarea
              rows={4}
              value={form.scope}
              onChange={(e) => update("scope", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Acceptance criteria</Label>
            <Textarea
              rows={4}
              value={form.acceptance}
              onChange={(e) => update("acceptance", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Support, defects, and changes</Label>
            <Textarea
              rows={4}
              value={form.support}
              onChange={(e) => update("support", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Client responsibilities</Label>
            <Textarea
              rows={4}
              value={form.responsibilities}
              onChange={(e) => update("responsibilities", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Confidentiality</Label>
            <Textarea
              rows={3}
              value={form.confidentiality}
              onChange={(e) => update("confidentiality", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Draft locally, then issue the signed record
          </p>
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
