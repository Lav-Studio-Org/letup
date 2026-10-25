// Offline cache. Bump VERSION when shipping changes so players get the new files.
const VERSION = 'letup-v6';
const FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest', 'icon.svg', 'fonts/fredoka-latin.woff2',
  'js/levels-data.js', 'js/engine.js', 'js/meta.js', 'js/audio.js', 'js/ads-config.js', 'js/ads.js', 'js/render.js', 'js/main.js',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// network first, cache as fallback, so updates show up right away when online
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request))
  );
});
