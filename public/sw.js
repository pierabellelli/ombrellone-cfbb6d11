const CACHE_NAME = 'ombrellone-v4';
const urlsToCache = ['/', '/index.html', '/login'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isSameOriginGet = event.request.method === 'GET' && url.origin === self.location.origin;

  // Only cache same-origin GET requests (the app shell). Every other request -
  // API calls to Supabase (GET/PATCH/POST/DELETE) in particular - must always
  // go straight to the network, uncached, so saves and fresh data are never
  // served stale or interfered with.
  if (!isSameOriginGet) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
