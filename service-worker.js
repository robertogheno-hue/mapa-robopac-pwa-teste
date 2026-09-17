const VERSION = "robopac-pwa-teste-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const TILE_CACHE = `${VERSION}-tiles`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./offline.html",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => ![SHELL_CACHE, RUNTIME_CACHE, TILE_CACHE].includes(key)).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

async function trimCache(cacheName, maximumItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  while (keys.length > maximumItems) await cache.delete(keys.shift());
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === "opaque")) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await caches.match("./index.html")) || caches.match("./offline.html");
  }
}

async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === "opaque")) {
    await cache.put(request, response.clone());
    if (limit) trimCache(cacheName, limit);
  }
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.hostname === "server.arcgisonline.com") {
    event.respondWith(cacheFirst(request, TILE_CACHE, 180));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  if (["script", "style", "font"].includes(request.destination)) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
  }
});

