/** Evento Chromium para instalar PWA. */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type InstallPromptListener = (event: BeforeInstallPromptEvent | null) => void;

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let captureInitialized = false;
const installPromptListeners = new Set<InstallPromptListener>();

function notifyInstallPromptListeners() {
  for (const listener of installPromptListeners) {
    listener(deferredInstallPrompt);
  }
}

/**
 * Debe ejecutarse lo antes posible (antes de montar React).
 * Si no, `beforeinstallprompt` puede dispararse y perderse.
 */
export function initPwaInstallCapture(): void {
  if (typeof window === 'undefined' || captureInitialized) return;
  captureInitialized = true;

  const win = window as Window & {
    __ptmDeferredInstall?: BeforeInstallPromptEvent | null;
  };

  // Si el script inline de index.html ya capturó el evento, reutilizarlo.
  if (win.__ptmDeferredInstall) {
    deferredInstallPrompt = win.__ptmDeferredInstall;
    win.__ptmDeferredInstall = null;
    notifyInstallPromptListeners();
  }

  const adoptPrompt = (event: Event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    win.__ptmDeferredInstall = null;
    notifyInstallPromptListeners();
  };

  window.addEventListener('beforeinstallprompt', adoptPrompt);
  window.addEventListener('ptm-beforeinstallprompt', () => {
    if (win.__ptmDeferredInstall) {
      deferredInstallPrompt = win.__ptmDeferredInstall;
      win.__ptmDeferredInstall = null;
      notifyInstallPromptListeners();
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    win.__ptmDeferredInstall = null;
    notifyInstallPromptListeners();
  });
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredInstallPrompt;
}

export function subscribeInstallPrompt(listener: InstallPromptListener): () => void {
  installPromptListeners.add(listener);
  listener(deferredInstallPrompt);
  return () => {
    installPromptListeners.delete(listener);
  };
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const notChrome = !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit && notChrome;
}

/** Chrome/Edge/Android Chromium (pueden mostrar el diálogo nativo de instalación). */
export function supportsNativeInstallPrompt(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (isIosSafari()) return false;
  const ua = navigator.userAgent;
  return /Chrome|Chromium|Edg|CriOS|EdgiOS/i.test(ua) || 'BeforeInstallPromptEvent' in window;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return registration;
  } catch {
    return null;
  }
}

function waitForInstallPrompt(timeoutMs: number): Promise<BeforeInstallPromptEvent | null> {
  if (deferredInstallPrompt) return Promise.resolve(deferredInstallPrompt);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      unsubscribe();
      resolve(deferredInstallPrompt);
    }, timeoutMs);
    const unsubscribe = subscribeInstallPrompt((event) => {
      if (!event) return;
      window.clearTimeout(timer);
      unsubscribe();
      resolve(event);
    });
  });
}

export type PwaInstallOutcome = 'accepted' | 'dismissed' | 'unavailable' | 'ios';

/**
 * Abre el diálogo nativo de instalación cuando el navegador lo permite.
 * En iOS no existe API: hay que guiar al usuario.
 */
export async function promptPwaInstall(): Promise<PwaInstallOutcome> {
  if (isStandaloneDisplay()) return 'accepted';
  if (isIosSafari()) return 'ios';

  initPwaInstallCapture();
  await registerServiceWorker();

  const win = window as Window & {
    __ptmDeferredInstall?: BeforeInstallPromptEvent | null;
  };
  if (!deferredInstallPrompt && win.__ptmDeferredInstall) {
    deferredInstallPrompt = win.__ptmDeferredInstall;
    win.__ptmDeferredInstall = null;
  }

  let event = deferredInstallPrompt ?? (await waitForInstallPrompt(4000));
  if (!event) {
    event = await waitForInstallPrompt(2000);
  }
  if (!event) return 'unavailable';

  deferredInstallPrompt = null;
  notifyInstallPromptListeners();

  await event.prompt();
  const choice = await event.userChoice;
  if (choice.outcome === 'accepted') return 'accepted';
  return 'dismissed';
}

// Auto-init al importar el módulo (cubre el caso de que main monte React tarde).
if (typeof window !== 'undefined') {
  initPwaInstallCapture();
}
