/**
 * Arranque seguro de cartas públicas (/p/…).
 * No debe bloquear el montaje de React: en móvil, getRegistrations() puede tardar
 * o colgarse y dejaba la página en «Cargando…» del index.html para siempre.
 */

const SW_CLEANUP_TIMEOUT_MS = 2500;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), ms);
    }),
  ]);
}

/** Limpia SW/cachés en segundo plano (nunca recarga ni bloquea). */
export function cleanupPublicMenuClientInBackground(): void {
  if (typeof window === 'undefined') return;
  if (!window.location.pathname.startsWith('/p/')) return;

  void (async () => {
    try {
      if (!('serviceWorker' in navigator)) return;

      const registrations = await withTimeout(navigator.serviceWorker.getRegistrations(), SW_CLEANUP_TIMEOUT_MS);
      if (registrations && registrations.length > 0) {
        await withTimeout(
          Promise.all(registrations.map((reg) => reg.unregister())),
          SW_CLEANUP_TIMEOUT_MS,
        );
      }

      if ('caches' in window) {
        const keys = await withTimeout(caches.keys(), SW_CLEANUP_TIMEOUT_MS);
        if (keys && keys.length > 0) {
          await withTimeout(Promise.all(keys.map((key) => caches.delete(key))), SW_CLEANUP_TIMEOUT_MS);
        }
      }
    } catch {
      /* best-effort */
    }
  })();
}

/** @deprecated Ya no bloquea ni recarga; conservado por compatibilidad. */
export async function preparePublicMenuClient(): Promise<'reloading' | 'ok'> {
  cleanupPublicMenuClientInBackground();
  return 'ok';
}

export function shouldRegisterServiceWorker(): boolean {
  if (typeof window === 'undefined') return false;
  return !window.location.pathname.startsWith('/p/');
}

export function isPublicMenuPath(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/p/');
}

export function clearPublicBootPlaceholder(): void {
  if (typeof document === 'undefined') return;
  document.getElementById('ptm-boot-status')?.remove();
}
