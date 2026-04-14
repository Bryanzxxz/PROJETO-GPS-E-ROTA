// ============================================================
// SERVICE WORKER — GUARUTONER PWA v2
// ============================================================

const CACHE_NAME = 'guarutoner-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/index.js',
  '/shared.css',
  '/tecnico.html',
  '/tecnico.js',
  '/tecnico.css',
  '/gestor.html',
  '/gestor.js',
  '/gestor.css',
  '/icons/logo.jpg',
  '/icons/logo.png',
  '/icons/icon-512.png',
  '/manifest.json'
];

// Instalar — cachear assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Ativar — limpar caches antigos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', (e) => {
  // Não cachear requisições de API
  if (e.request.url.includes('/login') ||
      e.request.url.includes('/location') ||
      e.request.url.includes('/tecnicos') ||
      e.request.url.includes('/cadastro') ||
      e.request.url.includes('/verificar') ||
      e.request.url.includes('/admin/') ||
      e.request.url.includes('/tecnico/') ||
      e.request.url.includes('/auth/')) {
    return;
  }

  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
