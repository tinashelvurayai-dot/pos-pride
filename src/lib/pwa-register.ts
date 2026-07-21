// Guarded service worker registration for cashier offline support.
// Never registers in Lovable preview/dev/iframe contexts.

function isPreviewOrDev(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (!import.meta.env.PROD) return true;
    if (window.self !== window.top) return true;
    const h = window.location.hostname;
    if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
    if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
    if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
    if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
    if (new URLSearchParams(window.location.search).has("sw") &&
        new URLSearchParams(window.location.search).get("sw") === "off") return true;
  } catch { /* noop */ }
  return false;
}

async function unregisterAppSW() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      const url = r.active?.scriptURL || "";
      if (url.endsWith("/sw.js")) await r.unregister();
    }
  } catch { /* noop */ }
}

export function registerPWA() {
  if (typeof window === "undefined") return;
  if (isPreviewOrDev()) {
    void unregisterAppSW();
    return;
  }
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* noop */ });
  });
}
