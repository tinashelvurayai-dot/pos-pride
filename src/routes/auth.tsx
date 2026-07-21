import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandLogo } from "@/components/brand-logo";
import { PWAInstallButton } from "@/components/pwa-install-button";
import { useOnline } from "@/hooks/use-online";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Invalid email").max(255);
const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(72);
const nameSchema = z.string().trim().min(2, "Full name required").max(100);

function AuthPage() {
  const navigate = useNavigate();
  const { session, role, loading } = useAuth();
  const online = useOnline();
  const [busy, setBusy] = useState(false);

  if (!loading && session && role === "manager") return <Navigate to="/manager" />;
  if (!loading && session && role === "cashier") return <Navigate to="/cashier" />;

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const email = emailSchema.parse(fd.get("email"));
      const password = passwordSchema.parse(fd.get("password"));
      setBusy(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Welcome back");
    } catch (err) {
      if (err instanceof z.ZodError) toast.error(err.issues[0].message);
      else toast.error("Sign in failed");
      setBusy(false);
    }
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const full_name = nameSchema.parse(fd.get("full_name"));
      const email = emailSchema.parse(fd.get("email"));
      const password = passwordSchema.parse(fd.get("password"));
      setBusy(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name },
        },
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Account created. You can sign in now.");
    } catch (err) {
      if (err instanceof z.ZodError) toast.error(err.issues[0].message);
      else toast.error("Sign up failed");
      setBusy(false);
    }
  }

  async function enterCashierMode() {
    if (session?.user.id) {
      navigate({ to: "/cashier" });
      return;
    }
    if (!online) {
      toast.error("Open Cashier Mode once while online, then it will stay available offline on this device.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInAnonymously({
      options: { data: { full_name: "Guest Cashier" } },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/cashier" });
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden p-10 text-white md:flex" style={{ background: "var(--gradient-brand)" }}>
        <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-black/10 blur-3xl" />
        <Link to="/" className="relative">
          <BrandLogo variant="light" />
        </Link>
        <div className="relative">
          <h2 className="text-4xl font-extrabold leading-tight">Run your shop like a boss.</h2>
          <p className="mt-4 max-w-sm text-white/85">
            The first account you create becomes the manager. Add cashier accounts from the staff screen once you are in.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/85">
            <li>- Variant-level stock and pricing</li>
            <li>- Cashier point-of-sale that works offline</li>
            <li>- Live dashboards for revenue and low stock</li>
          </ul>
        </div>
        <p className="relative text-sm text-white/70">© {new Date().getFullYear()} TillPoint</p>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden"><BrandLogo /></div>
          <h1 className="text-2xl font-bold">Welcome</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in or create the first manager account.</p>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="secondary" onClick={enterCashierMode} disabled={busy}>
              <ShoppingCart className="mr-2 h-4 w-4" /> {busy ? "Opening..." : "Enter Cashier Mode"}
            </Button>
            <PWAInstallButton variant="outline" label="Install app" />
          </div>

          <Tabs defaultValue="signin" className="mt-8">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="si-pw">Password</Label>
                  <Input id="si-pw" name="password" type="password" autoComplete="current-password" required />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="su-name">Full name</Label>
                  <Input id="su-name" name="full_name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-pw">Password</Label>
                  <Input id="su-pw" name="password" type="password" autoComplete="new-password" required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Creating..." : "Create account"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  The first account becomes the manager. Later signups default to cashier - managers should create cashiers from the staff screen.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
