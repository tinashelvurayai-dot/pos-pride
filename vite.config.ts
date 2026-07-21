import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        strategies: "generateSW",
        includeAssets: ["favicon.ico", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"],
        devOptions: { enabled: false },
        manifest: false,
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/api/, /^\/~oauth/, /^\/__l5e/],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "tillpoint-pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith("/__l5e/") || url.pathname.startsWith("/assets/"),
              handler: "CacheFirst",
              options: {
                cacheName: "tillpoint-static",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: ({ url }) => url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com",
              handler: "CacheFirst",
              options: {
                cacheName: "tillpoint-fonts",
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
      }),
    ],
  },
});
