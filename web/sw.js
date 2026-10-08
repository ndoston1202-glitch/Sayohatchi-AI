// Service worker: sayt internetsiz ham ochiladi va yangi versiya chiqqanda yangilanadi.
// Strategiya — "avval tarmoq": internet bo'lsa har doim yangi fayl olinadi, bo'lmasa keshdagisi beriladi.
const CACHE = "sayohatchi-v2";
const SHELL = ["./", "index.html", "app.js", "ai.js", "data.js", "config.js", "version.json", "manifest.webmanifest",
  "icon.png", "icon-192.png", "uz-regions.js", "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css"];

self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // API, xarita plitkalari va boshqa domenlar keshlanmaydi
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/api/") || url.pathname.endsWith(".apk")) return;
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
});
