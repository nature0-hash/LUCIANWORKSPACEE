/* LUCIAN Workspace — Service Worker
 *
 * Caches static application assets for offline use. Does NOT cache:
 *   - API responses (dynamic, may contain sensitive data)
 *   - AI provider responses
 *   - Market data
 *   - Authentication/API keys
 *
 * Strategy:
 *   - App shell (HTML, CSS, JS, icons): cache-first with network fallback
 *   - API routes: network-only (never cache)
 *   - Everything else: network-first with cache fallback
 */

const CACHE_NAME = "lucian-workspace-v2";
const APP_SHELL = [
  "/",
  "/markets",
  "/vault",
  "/economic-agent",
  "/dev-workspace",
  "/investing",
  "/notes",
  "/browser",
  "/knowledge-library",
  "/chess-academy",
  "/economy-hub",
  "/news-feed",
  "/manifest.json",
  "/branding/lucian-workspace-icon.png",
  "/branding/lucian-workspace-logo.png",
  "/branding/lucian-workspace-favicon.png",
  "/branding/icon-32.png",
  "/apple-icon.png",
  "/icon.png",
];

// Install — pre-cache the app shell.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

// Activate — clean up old caches.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — route requests appropriately.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache API routes — they may contain sensitive/dynamic data.
  if (url.pathname.startsWith("/api/")) {
    return; // Let the browser handle it (network-only).
  }

  // For navigation requests: network-first, fall back to cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // For static assets: cache-first, fall back to network.
  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return res;
        });
      })
    );
    return;
  }

  // Everything else: network-first.
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
