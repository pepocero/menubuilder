import { type ComponentType, lazy } from 'react';

const RELOAD_KEY = 'ptm-chunk-reload';

/**
 * lazy() con recuperación tras deploy: si el chunk falla (MIME text/html,
 * 404 de hash viejo), recarga UNA vez la página para obtener el index nuevo.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      try {
        if (!sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, '1');
          // Limpiar SW/caché best-effort antes de recargar.
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
          }
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
          window.location.reload();
          // Evita que React pinte un error mientras recarga.
          return new Promise<{ default: T }>(() => {});
        }
      } catch {
        /* ignore */
      }
      throw err;
    }
  });
}

/** Tras un arranque correcto, permitir otra recuperación en el futuro. */
export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    /* ignore */
  }
}
