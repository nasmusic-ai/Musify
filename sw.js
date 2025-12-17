// Musify – Cache-First Service Worker
// Version: 1.0.0  (bump this string any time you change static assets)
const CACHE_NAME = 'musify-v1';

// --- CRITICAL STATIC ASSETS ---
// Add every file you want available OFFLINE.
// Keep urls relative to the SW scope (root “/” in this app).
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/sw.js',
  '/manifest.json',
  '/logo.png',
  '/image.jpg',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2'
];

// --- INSTALL ----
self.addEventListener('install', event => {
  self.skipWaiting(); // activate worker immediately after install
  event.waitUntil(
    caches.open(CACHE_NAME)
          .then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// --- ACTIVATE ----
self.addEventListener('activate', event => {
  // Delete old caches that don’t match current version
  event.waitUntil(
    caches.keys()
          .then(keys => Promise.all(
            keys.map(key => {
              if (key !== CACHE_NAME) return caches.delete(key);
            })
          ))
          .then(() => self.clients.claim()) // take control of open pages
  );
});

// --- FETCH ----
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1.  Non-GET requests – go to network only
  if (request.method !== 'GET') return;

  // 2.  YouTube thumbnails / embeds – cache-first with network fallback
  if (url.hostname === 'img.youtube.com' || url.hostname === 'www.youtube.com') {
    event.respondWith(
      caches.match(request)
            .then(res => res || fetch(request)
              .then(netRes => {
                // optional: store successful network response for next offline visit
                const clone = netRes.clone();
                caches.open(CACHE_NAME).then(c => c.put(request, clone));
                return netRes;
              })
            )
            .catch(() => caches.match('/offline-image.svg')) // fallback placeholder
    );
    return;
  }

  // 3.  Font-Awesome CDN – cache-first
  if (url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(
      caches.match(request).then(res => res || fetch(request))
    );
    return;
  }

  // 4.  Everything else – cache-first, network fallback
  event.respondWith(
    caches.match(request)
          .then(res => res || fetch(request)
            .then(netRes => {
              // cache successful dynamic responses (optional)
              if (netRes.ok) {
                const clone = netRes.clone();
                caches.open(CACHE_NAME).then(c => c.put(request, clone));
              }
              return netRes;
            })
          )
          .catch(() => {
            // Ultimate fallback: offline page or generic response
            if (request.destination === 'document') {
              return caches.match('/offline.html');
            }
            return new Response('Offline – content unavailable', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain' })
            });
          })
  );
});

// --- BACKGROUND SYNC (optional) ----
// self.addEventListener('sync', event => {
//   if (event.tag === 'upload-video') {
//     event.waitUntil(uploadPendingVideos());
//   }
// });

// --- PUSH NOTIFICATIONS (optional) ----
// self.addEventListener('push', event => {
//   const payload = event.data?.json() ?? {};
//   event.waitUntil(
//     self.registration.showNotification(payload.title ?? 'Musify', {
//       body: payload.body,
//       icon: '/icon-192.png',
//       badge: '/icon-192.png',
//       vibrate: [200, 100, 200],
//       data: { url: payload.url ?? '/' }
//     })
//   );
// });

// self.addEventListener('notificationclick', event => {
//   event.notification.close();
//   const urlToOpen = event.notification.data?.url || '/';
//   event.waitUntil(clients.openWindow(urlToOpen));
// });
