const CACHE='cycle-pregnancy-tracker-v1';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.json','./data/cycle-phase-data.json','./data/pregnancy-weekly-data.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('./index.html'))));
});
