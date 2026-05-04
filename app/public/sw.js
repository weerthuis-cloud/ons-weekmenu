// Service worker v2.2 — basisbescherming tegen offline + cache-bust per release.
// Strategy: stale-while-revalidate voor app-assets, network-only voor Supabase.
// De Boodschappenlijst zelf wordt door de view in localStorage gecached
// (zie views/shopping.js) zodat hij offline leesbaar blijft.
//
// Cache-key komt uit ?v= query string. Bij elke release registreert main.js
// /sw.js?v=<VERSION> — dat invalideert browser-cache van sw.js zelf én geeft
// een nieuwe cache-namespace, zodat oude assets in activate gewist worden.

const VERSION = new URLSearchParams(self.location.search).get('v') || 'dev';
const CACHE = 'owm-' + VERSION;

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Supabase + auth API blijven online — geen offline cache.
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) return;
  // Cross-origin assets (bv. fonts) wel mee.

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);

    const fetchPromise = fetch(req).then(resp => {
      if (resp && resp.ok && (req.url.startsWith(self.location.origin) || resp.type === 'cors' || resp.type === 'basic')) {
        cache.put(req, resp.clone()).catch(() => {});
      }
      return resp;
    }).catch(() => null);

    return cached || fetchPromise || new Response('Offline en niet in cache', { status: 503 });
  })());
});
