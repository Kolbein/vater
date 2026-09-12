const CACHE_NAME = "bubble-level-v12";
// Only the icons are cached for offline use. The app shell (HTML/CSS/JS) is
// never cached here, so there is no possibility of the service worker ever
// serving stale logic again — it always goes straight to the network.
const ASSETS = ["./icons/icon-192.png", "./icons/icon-512.png"];

const NEVER_CACHE = [/\.html$/, /\.css$/, /\.js$/, /manifest\.webmanifest$/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        ASSETS.map(async (url) => {
          const response = await fetch(url, { cache: "reload" });
          await cache.put(url, response);
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (NEVER_CACHE.some((pattern) => pattern.test(url.pathname)) || url.pathname === "/" || url.pathname.endsWith("/")) {
    // App shell: always go straight to the network, bypassing the browser's
    // own HTTP cache too (not just the service worker's cache), so there is
    // no way to ever see stale logic here.
    event.respondWith(fetch(url.href, { cache: "reload" }));
    return;
  }

  // Everything else (icons): network-first, falling back to cache offline.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
