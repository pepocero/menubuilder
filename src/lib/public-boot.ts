/**
 * Arranque seguro de cartas públicas (/p/…).
 *
 * En móviles (sobre todo al abrir un QR), un Service Worker que controla la
 * pestaña puede dejar la SPA en blanco hasta recargar. Aquí:
 * 1) no dejamos que el SW controle /p/
 * 2) si había un controlador, recargamos UNA vez por ruta en la sesión
 */
export async function preparePublicMenuClient(): Promise<'reloading' | 'ok'> {
  if (typeof window === 'undefined') return 'ok';
  if (!window.location.pathname.startsWith('/p/')) return 'ok';

  const bootKey = `ptm-public-boot:${window.location.pathname}${window.location.search}`;

  try {
    if (!('serviceWorker' in navigator)) return 'ok';

    const hadController = !!navigator.serviceWorker.controller;
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length > 0) {
      await Promise.all(registrations.map((reg) => reg.unregister()));
    }

    if ('caches' in window) {
      const keys = await caches.keys();
      if (keys.length > 0) {
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    }

    if (hadController && !sessionStorage.getItem(bootKey)) {
      sessionStorage.setItem(bootKey, '1');
      window.location.reload();
      return 'reloading';
    }
  } catch {
    /* Si falla la limpieza, seguimos: mejor carta lenta que bloqueo total. */
  }

  return 'ok';
}

export function shouldRegisterServiceWorker(): boolean {
  if (typeof window === 'undefined') return false;
  return !window.location.pathname.startsWith('/p/');
}
