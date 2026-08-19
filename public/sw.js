const CACHE_NAME = 'studycat-shell-v3';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/studycat-icon-512.png',
  '/mascots/studycat-home.webp?v=3',
  '/mascots/studycat-tasks.webp?v=3',
  '/mascots/studycat-report.webp?v=3',
  '/mascots/studycat-reward.webp?v=3',
  '/mascots/studycat-center.webp?v=3',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/app-api') || url.pathname.includes('-api')) return;
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('/');
        return new Response('', { status: 503, statusText: 'Offline asset unavailable' });
      }),
  );
});
