import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      host: "0.0.0.0",
      strictPort: false,
    },
    preview: {
      host: "0.0.0.0",
      strictPort: false,
    },
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        strategies: "generateSW",
        includeAssets: [
          "favicon.ico",
          "manifest.webmanifest",
          "icons/icon-192.png",
          "icons/icon-512.png",
          "icons/apple-touch-icon.png",
        ],
        devOptions: { enabled: false },
        manifest: false,
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          globPatterns: ["**/*.{js,mjs,css,html,ico,png,svg,woff,woff2,webmanifest,json}"],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          additionalManifestEntries: [{ url: "/", revision: `${Date.now()}` }],
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/api/, /^\/~oauth/, /^\/__l5e/],
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.pathname.startsWith("/__l5e/") ||
                url.pathname.startsWith("/assets/") ||
                url.pathname.startsWith("/_build/"),
              handler: "CacheFirst",
              options: {
                cacheName: "tillpoint-static",
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 },
              },
            },
            {
              urlPattern: ({ url }) =>
                url.pathname.startsWith("/icons/") ||
                url.pathname === "/favicon.ico" ||
                url.pathname === "/manifest.webmanifest",
              handler: "CacheFirst",
              options: {
                cacheName: "tillpoint-icons",
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: ({ url }) =>
                url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com",
              handler: "CacheFirst",
              options: {
                cacheName: "tillpoint-fonts",
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === "image",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "tillpoint-images",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ url }) =>
                /\.supabase\.co$/.test(url.hostname) && url.pathname.startsWith("/rest/"),
              handler: "NetworkFirst",
              options: {
                cacheName: "tillpoint-api",
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
  },
});
