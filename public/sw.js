/* PWA: el SW debe existir para poder instalar, pero NO interceptar red.
 * Interceptar fetch rompía /assets con hash tras cada deploy (página en blanco / MIME text/html). */
const SW_VERSION = '2026-08-22-no-intercept-v2';

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

// No registrar 'fetch': deja pasar todo a la red. Así un deploy nuevo
// no sirve HTML cacheado como si fuera un .js.
void SW_VERSION;
