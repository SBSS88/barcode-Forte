const CACHE_NAME = "barcode-forte-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./JsBarcode.all.min.js",
  "./manifest.json",
  "./location.csv"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then(cached => {
      // cache-first
      return cached || fetch(req).then(resp => {
        // обновляем кэш на лету для наших файлов
        const url = new URL(req.url);
        const isSameOrigin = url.origin === self.location.origin;
        if (isSameOrigin && (url.pathname.endsWith(".js") || url.pathname.endsWith(".html") || url.pathname.endsWith(".csv") || url.pathname.endsWith(".json"))) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return resp;
      });
    })
  );
});

