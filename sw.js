importScripts('./env.js');
const CACHE = `xm-toolkit-v${APP_VERSION}`;
const ASSETS = [
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/sprites/resonator.png',
  './assets/sprites/linkamp.png',
  './assets/sprites/ultralink.png',
  'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Scheduled background notifications ──
const scheduled = {};

self.addEventListener('message', e => {
  if (e.data.type === 'schedule') {
    const { id, name, hacks, delay } = e.data;
    // Cancel any previous schedule for this timer
    if (scheduled[id]) clearTimeout(scheduled[id]);
    if (delay <= 0) return;

    // waitUntil keeps SW alive until the notification fires
    e.waitUntil(new Promise(resolve => {
      scheduled[id] = setTimeout(() => {
        delete scheduled[id];
        self.registration.showNotification('XM Toolkit', {
          body: `${name} READY — HACK ${hacks}`,
          icon: './assets/icons/icon-192.png',
          tag: `portal-${id}-${hacks}`,
          renotify: true,
          vibrate: [200, 100, 200, 100, 200],
        }).then(resolve, resolve);
      }, delay);
    }));
  }

  if (e.data.type === 'cancel') {
    if (scheduled[e.data.id]) {
      clearTimeout(scheduled[e.data.id]);
      delete scheduled[e.data.id];
    }
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length) clients[0].focus();
      else self.clients.openWindow('./');
    })
  );
});

self.addEventListener('fetch', e => {
  const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

  if (isDev) {
    // Dev: always fetch from network, fall back to cache if offline
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Production: cache-first, then network
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request).then(res => {
        if (e.request.method === 'GET' && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      }))
      .catch(() => caches.match('./index.html'))
  );
});
