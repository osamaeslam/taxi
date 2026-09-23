// Service Worker for Captain Ezz - University Shuttles & Rides (Ayat)
const CACHE_NAME = 'captain-ezz-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pre-caching some assets skipped:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET requests
  if (req.method !== 'GET') return;

  // For API or POST/data mutations, always bypass cache
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/rpc')) {
    return;
  }

  // Network-first strategy with cache fallback for pages and static assets
  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, resClone);
          });
        }
        return networkRes;
      })
      .catch(async () => {
        const cachedRes = await caches.match(req);
        if (cachedRes) return cachedRes;
        if (req.mode === 'navigate') {
          const fallback = await caches.match('/');
          if (fallback) return fallback;
        }
        return new Response(
          `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>كابتن عز — غير متصل</title><style>body{font-family:sans-serif;text-align:center;padding:40px;background:#f3f4f6;color:#1f2937}h1{color:#0e7c66}</style></head><body><h1>📡 أنت في وضع عدم الاتصال</h1><p>يرجى التأكد من اتصالك بالإنترنت للوصول إلى منظومة كابتن عز.</p><button onclick="location.reload()" style="background:#0e7c66;color:#fff;border:0;padding:10px 20px;border-radius:8px;font-size:16px;cursor:pointer;">إعادة المحاولة</button></body></html>`,
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      })
  );
});
