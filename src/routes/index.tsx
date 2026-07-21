import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { PWAInstallButton } from "@/components/pwa-install-button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShoppingCart, Package, BarChart3, Users, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [guestBusy, setGuestBusy] = useState(false);

  async function enterCashierMode() {
    setGuestBusy(true);
    const { error } = await supabase.auth.signInAnonymously({
      options: { data: { full_name: "Guest Cashier" } },
    });
    setGuestBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/cashier" });
  }
  const { session, role, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }

  if (session && role === "manager") return <Navigate to="/manager" />;
  if (session && role === "cashier") return <Navigate to="/cashier" />;

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full opacity-20 blur-3xl" style={{ background: "var(--gradient-brand)" }} />
        <div className="absolute -bottom-40 -left-40 h-[520px] w-[520px] rounded-full opacity-10 blur-3xl" style={{ background: "var(--gradient-brand)" }} />
      </div>

      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandLogo />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <a href="#features">Features</a>
            </Button>
            <PWAInstallButton variant="outline" size="sm" className="hidden sm:inline-flex" />
            <Button asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
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
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link to="/auth">Get started</Link>
            </Button>
            <Button size="lg" variant="secondary" className="h-12 px-6 text-base" onClick={enterCashierMode} disabled={guestBusy}>
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
    </div>
  );
}
