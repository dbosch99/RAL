// Incrementare la versione quando cambiano codice o risorse della PWA.
const CACHE_PREFIX = 'ral-pwa-';
const CACHE = `${CACHE_PREFIX}2026-10-26-v6`;
const ASSETS = [
  './', './index.html', './styles.css?v=ordinario-4', './src/app.js?v=ordinario-6', './src/calculator.js?v=ordinario-4', './src/chart.js?v=ordinario-4',
  './manifest.json', './Icone/RAL-16.png', './Icone/RAL-32.png',
  './Icone/RAL-180.png', './Icone/RAL-192.png', './Icone/RAL-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Le altre PWA condividono l'origine GitHub Pages: preservarne le cache.
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url), scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (req.mode === 'navigate' || req.destination === 'document'
      || url.pathname.endsWith('/manifest.json') || url.pathname.endsWith('/service-worker.js')) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(req, { cache: 'no-store' });
    if (fresh.ok) await cache.put(req, fresh.clone());
    return fresh;
  } catch {
    return await cache.match(req) || (req.mode === 'navigate' ? await cache.match('./index.html') : undefined)
      || new Response('Risorsa non disponibile offline', { status: 503 });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  if (fresh.ok) await cache.put(req, fresh.clone());
  return fresh;
}
