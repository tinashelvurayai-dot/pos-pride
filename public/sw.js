const VERSION = "tillpoint-cache-v3";
const STATIC_CACHE = VERSION;
const RUNTIME_CACHE = "tillpoint-runtime-v3";
const OFFLINE_URL = "/offline.html";
const SYNC_TAG = "tillpoint-sales";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/", "/manifest.webmanifest"])),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("tillpoint-") && key !== STATIC_CACHE && key !== RUNTIME_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !url.hostname.endsWith("supabase.co")) return;

  if (url.hostname.endsWith("supabase.co")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ offline: true, error: "Offline" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request)
            .then((response) => {
              const copy = response.clone();
              void caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
              return response;
            })
            .catch(() => caches.match(OFFLINE_URL)),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok || response.type === "opaque") {
            const copy = response.clone();
            void caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag !== SYNC_TAG) return;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) =>
        Promise.all(clients.map((client) => client.postMessage({ type: "RUN_SALES_SYNC" }))),
      ),
  );
});

self.addEventListener("push", () => {});
