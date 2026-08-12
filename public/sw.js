/* PWA: el SW debe existir para poder instalar, pero NO interceptar red.
 * Interceptar fetch rompía /assets con hash tras cada deploy (página en «Cargando…»). */
const SW_VERSION = '2026-08-13-no-intercept';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if ('caches' in self) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', () => {
  /* Intencionadamente vacío: el navegador usa la red. */
});
