const CACHE_NAME = "barcode-forte-v3";

const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
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
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  event.respondWith(
    caches.match(req).then(cached => {
      return cached || fetch(req).then(resp => {
        const url = new URL(req.url);
        const isSameOrigin = url.origin === self.location.origin;

        if (
          isSameOrigin &&
          (
            url.pathname.endsWith(".js") ||
            url.pathname.endsWith(".html") ||
            url.pathname.endsWith(".csv") ||
            url.pathname.endsWith(".json")
          )
        ) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }

        return resp;
      });
    })
  );
});
