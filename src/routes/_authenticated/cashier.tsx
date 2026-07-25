import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useOnline } from "@/hooks/use-online";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SignOutButton } from "@/components/sign-out-button";
import { BrandLogo } from "@/components/brand-logo";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { ShoppingCart, Search, Trash2, Plus, Minus, Package as PackageIcon, Wifi, WifiOff, BookOpen, CloudUpload, ClipboardList, HelpCircle, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { enqueueSale, flushQueue, getQueue } from "@/lib/offline-queue";
import { VoiceMicButton } from "@/components/voice-mic-button";
import { PWAInstallButton } from "@/components/pwa-install-button";
import { useHideImages } from "@/hooks/use-hide-images";

export const Route = createFileRoute("/_authenticated/cashier")({
  component: CashierScreen,
});

type Variant = {
  id: string;
  variant_name: string;
  size: string | null;
  flavour: string | null;
  price: number;
  image_url: string | null;
  active: boolean;
  product: { id: string; name: string; category: string | null; image_url: string | null } | null;
  stock: { quantity: number } | null;
};

type CartLine = { variant: Variant; qty: number };
type SyncStatus = "idle" | "syncing" | "synced" | "failed";

const OFFLINE_CACHE_KEY = "tillpoint.cashier.catalog.v1";

function CashierScreen() {
  const { role, profile, session, loading } = useAuth();
  const qc = useQueryClient();
  const online = useOnline();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<"cash" | "mobile" | "other">("cash");
  const [checkingOut, setCheckingOut] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [voiceHelpOpen, setVoiceHelpOpen] = useState(false);
  const [queuedCount, setQueuedCount] = useState<number>(() => getQueue().length);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSync, setLastSync] = useState<string | null>(null);

  const variants = useQuery({
    queryKey: ["cashier", "variants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, variant_name, size, flavour, price, image_url, active, product:products(id, name, category, image_url), stock(quantity)")
        .eq("active", true)
        .order("variant_name");
      if (error) throw error;
      const list = (data as unknown as Variant[]).filter((v) => v.product);
      try { localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(list)); } catch { /* noop */ }
      return list;
    },
  });

  const offlineList = useMemo<Variant[]>(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
      return raw ? (JSON.parse(raw) as Variant[]) : [];
    } catch { return []; }
  }, [variants.data]);

  const list: Variant[] = variants.data ?? offlineList;

  const settings = useQuery({
    queryKey: ["cashier", "settings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("show_cashier_manual").eq("id", true).maybeSingle();
      return data ?? { show_cashier_manual: true };
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return list.filter((v) => {
      if (!q) return true;
      return v.variant_name.toLowerCase().includes(q) || v.product?.name.toLowerCase().includes(q) || v.product?.category?.toLowerCase().includes(q);
    });
  }, [search, list]);

  const subtotal = cart.reduce((s, l) => s + Number(l.variant.price) * l.qty, 0);

  const syncOfflineQueue = useCallback(async (showEmptyToast = false) => {
    if (!online) {
      toast.error("You are offline. Sync will start when the connection returns.");
      return;
    }
    const q = getQueue();
    setQueuedCount(q.length);
    if (q.length === 0) {
      setSyncStatus("synced");
      setLastSync(new Date().toISOString());
      if (showEmptyToast) toast.success("Everything is synced");
      return;
    }
    setSyncStatus("syncing");
    toast.info(`Syncing ${q.length} offline sale${q.length === 1 ? "" : "s"}...`);
    const res = await flushQueue();
    const remaining = getQueue().length;
    setQueuedCount(remaining);
    setLastSync(new Date().toISOString());
    if (res.failed > 0) {
      setSyncStatus("failed");
      toast.error(`${res.failed} sale${res.failed === 1 ? "" : "s"} could not sync - will retry`);
    } else {
      setSyncStatus("synced");
      if (res.ok > 0) toast.success(`${res.ok} offline sale${res.ok === 1 ? "" : "s"} synced`);
    }
    qc.invalidateQueries({ queryKey: ["cashier"] });
  }, [online, qc]);

  // Auto-sync queued sales when back online
  useEffect(() => {
    if (!online) {
      setSyncStatus(getQueue().length > 0 ? "idle" : "synced");
      return;
    }
    qc.invalidateQueries({ queryKey: ["cashier"] });
    void syncOfflineQueue(false);
  }, [online, qc, syncOfflineQueue]);

  function addToCart(v: Variant) {
    const stockQty = v.stock?.quantity ?? 0;
    setCart((prev) => {
      const existing = prev.find((l) => l.variant.id === v.id);
      const currentQty = existing?.qty ?? 0;
      if (currentQty + 1 > stockQty) {
        toast.error(`Only ${stockQty} in stock`);
        return prev;
      }
      if (existing) return prev.map((l) => (l.variant.id === v.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { variant: v, qty: 1 }];
    });
  }
  function changeQty(id: string, delta: number) {
    setCart((prev) => prev.flatMap((l) => {
      if (l.variant.id !== id) return [l];
      const next = l.qty + delta;
      if (next <= 0) return [];
      if (next > (l.variant.stock?.quantity ?? 0)) {
        toast.error(`Only ${l.variant.stock?.quantity ?? 0} in stock`);
        return [l];
      }
      return [{ ...l, qty: next }];
    }));
  }
  function removeLine(id: string) { setCart((prev) => prev.filter((l) => l.variant.id !== id)); }

  function findVariantByPhrase(phrase: string): Variant | null {
    const q = phrase.toLowerCase().trim();
    if (!q) return null;
    const scored = list
      .map((v) => {
        const hay = `${v.product?.name ?? ""} ${v.variant_name} ${v.size ?? ""} ${v.flavour ?? ""}`.toLowerCase();
        let score = 0;
        for (const w of q.split(/\s+/).filter(Boolean)) if (hay.includes(w)) score++;
        return { v, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored[0]?.v ?? null;
  }

  function handleVoice(raw: string) {
    const text = raw.toLowerCase().trim().replace(/[.,!?]/g, "");
    if (!text) return;

    // "new" / "new sale" / "clear" -> reset cart
    if (/^(new( sale)?|clear|reset)$/.test(text)) {
      setCart([]);
      toast.info("Cart cleared");
      return;
    }
    // "checkout" / "complete sale" / "pay"
    if (/^(checkout|complete( sale)?|pay|finish)$/.test(text)) {
      if (cart.length === 0) return toast.error("Cart is empty");
      checkout.mutate();
      return;
    }
    // "cash" / "mobile" / "ecocash"
    if (/^cash$/.test(text)) { setPayment("cash"); toast.info("Payment: Cash"); return; }
    if (/^(mobile|ecocash|eco cash)$/.test(text)) { setPayment("mobile"); toast.info("Payment: EcoCash / Mobile"); return; }

    // "remove <phrase>" -> remove matching cart line
    const rm = text.match(/^remove\s+(.+)$/);
    if (rm) {
      const line = cart.find((l) => `${l.variant.product?.name} ${l.variant.variant_name}`.toLowerCase().includes(rm[1]));
      if (line) { removeLine(line.variant.id); toast.success(`Removed ${line.variant.product?.name}`); }
      else toast.error(`Not in cart: ${rm[1]}`);
      return;
    }
    // "search <phrase>"
    const sr = text.match(/^(search|find)\s+(.+)$/);
    if (sr) { setSearch(sr[2]); return; }

    // "add <n> <phrase>" or "<n> <phrase>" or "add <phrase>"
    const addN = text.match(/^(?:add\s+)?(\d+)\s+(.+)$/);
    const addPhrase = text.match(/^add\s+(.+)$/);
    let qty = 1;
    let phrase = text;
    if (addN) { qty = Math.max(1, parseInt(addN[1], 10)); phrase = addN[2]; }
    else if (addPhrase) { phrase = addPhrase[1]; }

    const v = findVariantByPhrase(phrase);
    if (!v) { setSearch(phrase); toast.info(`Searching "${phrase}"`); return; }
    for (let i = 0; i < qty; i++) addToCart(v);
    toast.success(`Added ${qty} × ${v.product?.name}`);
  }

  const checkout = useMutation({
    mutationFn: async () => {
      if (!session?.user.id) throw new Error("Not signed in");
      if (cart.length === 0) throw new Error("Cart is empty");

      const items = cart.map((l) => ({
        variant_id: l.variant.id,
        quantity: l.qty,
        unit_price: Number(l.variant.price),
        subtotal: Number(l.variant.price) * l.qty,
      }));

      if (!online) {
        // Queue for later sync
        enqueueSale({
          cashier_id: session.user.id,
          total_amount: subtotal,
          payment_type: payment,
          items,
        });
        setQueuedCount(getQueue().length);
        setSyncStatus("idle");
        return { queued: true as const };
      }

      const { data: sale, error: saleErr } = await supabase.from("sales").insert({
        cashier_id: session.user.id,
        total_amount: subtotal,
        payment_type: payment,
      }).select("id").single();
      if (saleErr) throw saleErr;

      const { error: itemsErr } = await supabase.from("sale_items").insert(items.map((i) => ({ ...i, sale_id: sale.id })));
      if (itemsErr) throw itemsErr;
      return { queued: false as const };
    },
    onMutate: () => setCheckingOut(true),
    onSettled: () => setCheckingOut(false),
    onSuccess: (res) => {
      if (res?.queued) {
        toast.success(`Sale queued offline - will sync when online (${formatCurrency(subtotal)})`);
      } else {
        toast.success(`Sale of ${formatCurrency(subtotal)} recorded`);
      }
      setCart([]);
      qc.invalidateQueries({ queryKey: ["cashier"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (role === "manager") return <Navigate to="/manager" />;

  const showManual = settings.data?.show_cashier_manual !== false;

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1fr_400px]">
      <div className="flex flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <BrandLogo />
            <div className="hidden sm:block border-l border-border pl-3">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cashier</div>
              <div className="text-sm font-semibold">{profile?.full_name}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {queuedCount > 0 && (
              <Badge className="gap-1 bg-blue-600 text-white"><CloudUpload className="h-3 w-3" /> {queuedCount} pending</Badge>
            )}
            {online ? (
              <Badge variant="outline" className="gap-1 border-blue-300 text-blue-700"><Wifi className="h-3 w-3" /> Online</Badge>
            ) : (
              <Badge variant="destructive" className="gap-1"><WifiOff className="h-3 w-3" /> Offline</Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => syncOfflineQueue(true)} disabled={!online || syncStatus === "syncing"}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncStatus === "syncing" ? "animate-spin" : ""}`} /> Sync
            </Button>
            <VoiceMicButton onFinalTranscript={handleVoice} label="Voice" />
            <Button variant="outline" size="sm" onClick={() => setVoiceHelpOpen(true)}>
              <HelpCircle className="mr-2 h-4 w-4" /> Voice help
            </Button>
            <PWAInstallButton variant="outline" size="sm" label="Install" />
            <Link to="/orders">
              <Button variant="outline" size="sm">
                <ClipboardList className="mr-2 h-4 w-4" /> Orders
              </Button>
            </Link>
            {showManual && (
              <Button variant="outline" size="sm" onClick={() => setManualOpen(true)}>
                <BookOpen className="mr-2 h-4 w-4" /> Manual
              </Button>
            )}
            <SignOutButton variant="outline" />

          </div>
        </header>

        <div className={`border-b px-4 py-3 text-xs sm:px-6 ${online ? "border-blue-100 bg-blue-50 text-blue-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {syncStatus === "syncing" ? <RefreshCw className="h-4 w-4 animate-spin" /> : online ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <span className="font-medium">
                {!online
                  ? "Offline mode active - sales are saved on this device."
                  : syncStatus === "syncing"
                    ? "Syncing offline sales now..."
                    : queuedCount > 0
                      ? `${queuedCount} offline sale${queuedCount === 1 ? "" : "s"} waiting to sync.`
                      : "Online and synced."}
              </span>
            </div>
            <span className="text-muted-foreground">
              {lastSync ? `Last sync: ${new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Catalog is available after it loads once."}
            </span>
          </div>
        </div>

        <div className="border-b border-border bg-card px-4 py-3 sm:px-6">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {variants.isLoading && list.length === 0 ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <PackageIcon className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No products found.</p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {filtered.map((v) => {
                const qty = v.stock?.quantity ?? 0;
                const image = v.image_url || v.product?.image_url;
                return (
                  <button
                    key={v.id}
                    onClick={() => addToCart(v)}
                    disabled={qty === 0}
                    className="group overflow-hidden rounded-xl border border-border bg-card text-left shadow-[var(--shadow-elev-1)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elev-2)] disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    <div className="aspect-square overflow-hidden bg-accent">
                      {image ? (
                        <img src={image} alt={v.product?.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                      ) : (
                        <div className="grid h-full w-full place-items-center"><PackageIcon className="h-8 w-8 text-muted-foreground" /></div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="truncate text-sm font-semibold">{v.product?.name}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{v.variant_name}{v.size ? ` - ${v.size}` : ""}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-base font-bold">{formatCurrency(v.price)}</span>
                        {qty === 0 ? <Badge variant="destructive">Out</Badge> : qty <= 5 ? <Badge className="bg-amber-500 text-white">Low</Badge> : <span className="text-xs text-muted-foreground">{qty} left</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <aside className="flex flex-col border-t border-border bg-card lg:border-l lg:border-t-0">
        <div className="border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-lg font-bold">Current sale</h2>
          <p className="text-xs text-muted-foreground">{cart.length} line{cart.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex-1 overflow-auto px-4 py-3">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <ShoppingCart className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">Tap a product to start.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {cart.map((l) => (
                <li key={l.variant.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{l.variant.product?.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{l.variant.variant_name}</div>
                    </div>
                    <button onClick={() => removeLine(l.variant.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="inline-flex items-center gap-1 rounded-md border border-border">
                      <button onClick={() => changeQty(l.variant.id, -1)} className="grid h-8 w-8 place-items-center hover:bg-accent"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-8 text-center text-sm font-medium">{l.qty}</span>
                      <button onClick={() => changeQty(l.variant.id, 1)} className="grid h-8 w-8 place-items-center hover:bg-accent"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="text-sm font-semibold">{formatCurrency(Number(l.variant.price) * l.qty)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-border p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Payment</label>
            <Select value={payment} onValueChange={(v) => setPayment(v as typeof payment)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mobile">EcoCash / Mobile</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>

            </Select>
          </div>
          <div className="flex items-center justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <Button className="w-full" size="lg" disabled={cart.length === 0 || checkingOut} onClick={() => checkout.mutate()}>
            {checkingOut ? "Processing..." : online ? "Complete sale" : "Queue sale (offline)"}
          </Button>
        </div>
      </aside>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader><DialogTitle>Cashier User Manual</DialogTitle></DialogHeader>
          <CashierManualContent />
        </DialogContent>
      </Dialog>
      <Dialog open={voiceHelpOpen} onOpenChange={setVoiceHelpOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Voice commands</DialogTitle></DialogHeader>
          <VoiceCommandHelp />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function VoiceCommandHelp() {
  const commands = [
    ["add Coke", "Adds the best matching product to the cart."],
    ["add 3 Coke", "Adds a quantity in one command."],
    ["remove Coke", "Removes a matching item from the cart."],
    ["search sugar", "Filters the product grid."],
    ["new" , "Clears the current cart for a new sale."],
    ["cash", "Sets payment to Cash."],
    ["ecocash", "Sets payment to EcoCash / Mobile."],
    ["checkout", "Completes or queues the sale, depending on connection."],
  ];
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">Tap Voice, speak one command clearly, then wait for the action to complete.</p>
      <div className="grid gap-2">
        {commands.map(([command, description]) => (
          <div key={command} className="grid gap-2 rounded-lg border border-blue-100 bg-blue-50/40 p-3 sm:grid-cols-[140px_1fr]">
            <code className="font-semibold text-blue-800">{command}</code>
            <span className="text-muted-foreground">{description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CashierManualContent() {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <section>
        <h3 className="font-semibold text-base">1. Opening cashier mode</h3>
        <p className="text-muted-foreground">From the welcome or auth page, tap Enter Cashier Mode. The till opens without a password for fast counter access. Named cashier accounts can still sign in when the manager wants staff-specific tracking.</p>
      </section>
      <section>
        <h3 className="font-semibold text-base">2. Finding a product</h3>
        <p className="text-muted-foreground">Use the search bar at the top of the product grid. You can search by product name, variant, or category.</p>
      </section>
      <section>
        <h3 className="font-semibold text-base">3. Adding items to the cart</h3>
        <p className="text-muted-foreground">Tap any product card. It appears in the current sale panel. Use plus and minus to change quantity. Tap the trash icon to remove a line.</p>
      </section>
      <section>
        <h3 className="font-semibold text-base">4. Taking payment</h3>
        <p className="text-muted-foreground">Choose the payment method, confirm the total with the customer, and tap Complete sale. Stock updates automatically.</p>
      </section>
      <section>
        <h3 className="font-semibold text-base">5. Voice commands</h3>
        <p className="text-muted-foreground">Tap Voice and say commands such as add Coke, add 3 Coke, remove Coke, search sugar, new, cash, ecocash, or checkout. Use Voice help in the cashier top bar for the full list.</p>
      </section>
      <section>
        <h3 className="font-semibold text-base">6. Working offline and syncing</h3>
        <p className="text-muted-foreground">If the connection drops, keep serving customers. Sales are stored securely on this device, a pending badge shows what is waiting, and sync runs automatically when the device comes back online. You can also press Sync while online.</p>
      </section>
      <section>
        <h3 className="font-semibold text-base">7. Stock warnings</h3>
        <p className="text-muted-foreground">Out means the item cannot be sold. Low means only a few units remain - let the manager know.</p>
      </section>
      <section>
        <h3 className="font-semibold text-base">8. Installing on a device</h3>
        <p className="text-muted-foreground">Tap Install in Chrome or Edge on the published site. The app appears with the other apps on the device and keeps the cashier dashboard available after it has loaded once.</p>
      </section>
      <section>
        <h3 className="font-semibold text-base">9. Signing out</h3>
        <p className="text-muted-foreground">Tap Sign out at the end of your shift when using a named account. Shared cashier mode can be opened again from the auth page.</p>
      </section>
    </div>
  );
}
