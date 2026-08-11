/* Service worker mínimo: requerido para que la PWA sea instalable.
 * No intercepta cartas públicas ni API: evita pantallas en blanco al abrir un QR. */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  let pathname = '/';
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return;
  }

  // Dejar que el navegador gestione estas rutas sin el SW.
  if (
    pathname.startsWith('/p/') ||
    pathname.startsWith('/api/') ||
    pathname === '/sw.js' ||
    pathname === '/manifest.webmanifest'
  ) {
    return;
  }

  // Navegaciones HTML: red directa (sin caché del SW).
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(fetch(request));
});
