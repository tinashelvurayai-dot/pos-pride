import { createFileRoute, Navigate, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BrandLogo } from "@/components/brand-logo";
import { PWAInstallButton } from "@/components/pwa-install-button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShoppingCart, Package, BarChart3, Users, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

const CODE_1 = "POSPRIDE";
const CODE_2 = "POSTAT";

function Landing() {
  const navigate = useNavigate();
  const [guestBusy, setGuestBusy] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");
  const [unlockBusy, setUnlockBusy] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function enterCashierMode() {
    setGuestBusy(true);
    try {
      localStorage.setItem("cashier_unlock", "true");
      const { data } = await supabase.auth.getSession();
      // Only attempt anonymous sign-in when online AND no session yet.
      if (!data.session && typeof navigator !== "undefined" && navigator.onLine) {
        const { error } = await supabase.auth.signInAnonymously({
          options: { data: { full_name: "Guest Cashier" } },
        });
        if (error) {
          // Non-fatal offline: cashier_unlock flag lets the route render.
          console.warn("Cashier anon sign-in failed:", error.message);
        }
      }
      navigate({ to: "/cashier" });
    } finally {
      setGuestBusy(false);
    }
  }

  function handleLogoTap() {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 2000);
    if (tapCountRef.current >= 7) {
      tapCountRef.current = 0;
      setGateOpen(true);
    }
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (c1.trim().toUpperCase() !== CODE_1 || c2.trim().toUpperCase() !== CODE_2) {
      toast.error("Invalid access codes");
      return;
    }
    setUnlockBusy(true);
    try {
      localStorage.setItem("manager_unlock", "true");
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const { error } = await supabase.auth.signInAnonymously({
          options: { data: { full_name: "Manager" } },
        });
        if (error) {
          toast.error(error.message);
          setUnlockBusy(false);
          return;
        }
      }
      setGateOpen(false);
      navigate({ to: "/manager" });
    } finally {
      setUnlockBusy(false);
    }
  }

  const { session, role, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }

  const unlocked = typeof window !== "undefined" && localStorage.getItem("manager_unlock") === "true";
  if (session && (role === "manager" || unlocked)) return <Navigate to="/manager" />;
  if (session && role === "cashier") return <Navigate to="/cashier" />;

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full opacity-20 blur-3xl" style={{ background: "var(--gradient-brand)" }} />
        <div className="absolute -bottom-40 -left-40 h-[520px] w-[520px] rounded-full opacity-10 blur-3xl" style={{ background: "var(--gradient-brand)" }} />
      </div>

      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button
            type="button"
            onClick={handleLogoTap}
            aria-label="TillPoint"
            className="cursor-pointer select-none rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <BrandLogo />
          </button>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <a href="#features">Features</a>
            </Button>
            <PWAInstallButton variant="outline" size="sm" className="hidden sm:inline-flex" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16 md:pt-24">
        <div className="max-w-3xl">
          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
            Sell faster.<br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-brand)" }}>
              Track every unit.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            A point-of-sale built for modern retail. Variant-level inventory, dual-role dashboards and real-time stock in one operating system for your shop floor and back office.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" className="h-12 px-6 text-base" onClick={enterCashierMode} disabled={guestBusy}>
              <ShoppingCart className="mr-2 h-5 w-5" /> {guestBusy ? "Opening..." : "Enter Cashier Mode"}
            </Button>
            <PWAInstallButton size="lg" variant="outline" className="h-12 px-6 text-base" label="Install this app" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Cashier Mode opens the till without a password - perfect for a shared counter device. Install the app so it appears on the home screen and keeps working offline.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Encrypted end-to-end</div>
            <div className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-primary" /> Works offline at the till</div>
            <div className="flex items-center gap-1.5"><BarChart3 className="h-4 w-4 text-primary" /> Live analytics</div>
          </div>
        </div>

        <section id="features" className="mt-24 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Package, title: "Variant inventory", body: "Track sizes, flavours, and colors per product with per-variant pricing and stock." },
            { icon: ShoppingCart, title: "Fast cashier flow", body: "Grid of products, one-tap add to cart, cash / mobile / card checkout." },
            { icon: BarChart3, title: "Live sales insight", body: "Realtime dashboards for revenue, top sellers, and low-stock alerts." },
            { icon: Users, title: "Staff roles", body: "Managers get full control; cashiers get a focused selling screen." },
          ].map((f) => (
            <div key={f.title} className="group rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elev-1)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elev-2)]">
              <div className="grid h-10 w-10 place-items-center rounded-lg text-white" style={{ background: "var(--gradient-brand)" }}>
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} TillPoint. Built for retail.
      </footer>

      <Dialog open={gateOpen} onOpenChange={setGateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manager access</DialogTitle>
            <DialogDescription>Enter both access codes to continue.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code1">Code 1</Label>
              <Input id="code1" value={c1} onChange={(e) => setC1(e.target.value)} autoComplete="off" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code2">Code 2</Label>
              <Input id="code2" type="password" value={c2} onChange={(e) => setC2(e.target.value)} autoComplete="off" />
            </div>
            <Button type="submit" className="w-full" disabled={unlockBusy}>
              {unlockBusy ? "Unlocking..." : "Unlock"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
