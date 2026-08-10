const CACHE_NAME = 'sedekahqr-shell-v14';
const APP_SHELL = [
  './',
  './index.html',
  './blog.html',
  './article.html',
  './admin.html',
  './styles.css',
  './blog.css',
  './admin.css',
  './script.js',
  './blog.js',
  './article.js',
  './admin.js',
  './blog-api.js',
  './blog-config.js',
  './articles.json',
  './notification.js',
  './analytics.js',
  './push-config.js',
  './prayer-zones.js',
  './qr-data.js',
  './manifest.webmanifest',
  './assets/sedekahqr-logo.svg',
  './assets/sedekahqr-icon-192.png',
  './assets/sedekahqr-icon-512.png',
  './assets/blog-hero-quran.jpg',
  './assets/banner-sedekah-subuh.jpg',
  './assets/banner-sedekah-komuniti.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    const navigationKey = url.pathname.endsWith('/blog.html')
      ? './blog.html'
      : url.pathname.endsWith('/article.html')
        ? './article.html'
        : url.pathname.endsWith('/admin.html')
          ? './admin.html'
        : './index.html';
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(navigationKey, copy));
          return response;
        })
        .catch(() => caches.match(navigationKey).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});

self.addEventListener('message', (event) => {
  if (!['SHOW_TEST_NOTIFICATION', 'SHOW_PUSH_NOTIFICATION'].includes(event.data?.type)) return;

  const isTest = event.data.type === 'SHOW_TEST_NOTIFICATION';

  event.waitUntil(self.registration.showNotification(event.data.title || 'Peringatan Subuh', {
    body: event.data.body || 'Mulakan pagi dengan syukur, doa dan satu kebaikan.',
    icon: './assets/sedekahqr-logo.svg',
    badge: './assets/sedekahqr-logo.svg',
    tag: isTest ? 'sedekahqr-test' : `sedekahqr-subuh-${event.data.date || 'today'}`,
    data: { url: event.data.url || './#direktori' }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || './#direktori', self.registration.scope).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const matchingClient = clients.find((client) => client.url.startsWith(self.registration.scope));
      if (matchingClient) {
        matchingClient.navigate(targetUrl);
        return matchingClient.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { body: event.data?.text() || '' };
  }

  event.waitUntil(self.registration.showNotification(data.title || 'Peringatan Subuh', {
    body: data.body || 'Mulakan pagi dengan syukur, doa dan satu kebaikan.',
    icon: './assets/sedekahqr-icon-192.png',
    badge: './assets/sedekahqr-icon-192.png',
    tag: `sedekahqr-subuh-${data.date || 'today'}`,
    data: { url: data.url || './#direktori' }
  }));
});
