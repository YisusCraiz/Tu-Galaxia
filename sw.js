const CACHE = 'tu-galaxia-shell-v2';
const scope = new URL(self.registration.scope);
const home = new URL('./', scope).href;
const files = ['./', './manifest.webmanifest', './assets/icon-180.png', './assets/icon-192.png',
  './assets/icon-512.png', './assets/mahiru-gala.svg', './assets/amane-gala.svg', './assets/mahiru.svg', './assets/amane.svg']
  .map(path => new URL(path, scope).href);
const assets = new Set(files.slice(1));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache =>
    cache.addAll(files.map(url => new Request(url, {cache: 'reload'})))
  ));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('tu-galaxia-shell-') && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const {request} = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== scope.origin) return;
  const page = request.mode === 'navigate' &&
    (url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html');
  if (!page && !assets.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = page ? home : request.url;
    try {
      const response = await fetch(request);
      if (response.ok) {
        try { await cache.put(key, response.clone()); } catch {}
        return response;
      }
      return await cache.match(key) || response;
    } catch {
      return await cache.match(key) || Response.error();
    }
  })());
});
