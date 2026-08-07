import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { appAlert } from '@/lib/app-dialog';
import {
  isIosSafari,
  isStandaloneDisplay,
  type BeforeInstallPromptEvent,
} from '@/lib/pwa';

function BurgerIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          fill="currentColor"
          d="M18.3 5.71 12 12.01 5.7 5.7 4.29 7.11 10.59 13.4 4.29 19.7 5.7 21.11 12 14.82l6.3 6.29 1.41-1.41-6.29-6.3 6.29-6.29z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="currentColor" d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
    </svg>
  );
}

function InstallIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"
      />
    </svg>
  );
}

export function AppLayout() {
  const { user, logout, isSystemAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [installed, setInstalled] = useState(() => isStandaloneDisplay());
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const syncInstalled = () => setInstalled(isStandaloneDisplay());
    syncInstalled();

    if (isStandaloneDisplay()) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    const mediaQueries = [
      window.matchMedia('(display-mode: standalone)'),
      window.matchMedia('(display-mode: fullscreen)'),
      window.matchMedia('(display-mode: minimal-ui)'),
    ];
    for (const mq of mediaQueries) {
      mq.addEventListener('change', syncInstalled);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      for (const mq of mediaQueries) {
        mq.removeEventListener('change', syncInstalled);
      }
    };
  }, []);

  // Visible siempre que no esté instalada (antes solo salía con beforeinstallprompt / iOS).
  const showInstall = !installed;

  async function handleInstallClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === 'accepted') {
        setInstalled(true);
      }
      return;
    }

    if (isIosSafari()) {
      await appAlert(
        'En iPhone/iPad: toca Compartir (□↑) y elige «Añadir a pantalla de inicio». Así Paper To Menu se abre como app, sin barra del navegador.',
        {
          title: 'Instalar en el iPhone',
          confirmText: 'Entendido',
        },
      );
      return;
    }

    await appAlert(
      'Para instalar: abre el menú del navegador (⋮) y elige «Instalar aplicación» o «Añadir a la pantalla de inicio». Si no aparece aún, recarga la página o usa Chrome/Edge en el móvil.',
      {
        title: 'Instalar Paper To Menu',
        confirmText: 'Entendido',
      },
    );
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <Link to="/" className="logo" onClick={() => setMenuOpen(false)}>
          Paper To Menu
        </Link>
        <div className="app-header-actions">
          {showInstall && (
            <button
              type="button"
              className="btn-pwa-install"
              onClick={() => void handleInstallClick()}
              title="Instalar Paper To Menu en este dispositivo"
            >
              <InstallIcon />
              Instalar
            </button>
          )}
          <button
            type="button"
            className="app-nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="app-nav"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <BurgerIcon open={menuOpen} />
          </button>
        </div>
        <nav id="app-nav" className={`app-nav${menuOpen ? ' app-nav--open' : ''}`}>
          <Link to="/dashboard" onClick={() => setMenuOpen(false)}>
            Mis menús
          </Link>
          <Link to="/templates" onClick={() => setMenuOpen(false)}>
            Plantillas
          </Link>
          <Link to="/qrs" onClick={() => setMenuOpen(false)}>
            Mis QR
          </Link>
          <Link to="/documentacion" onClick={() => setMenuOpen(false)}>
            Documentación
          </Link>
          {isSystemAdmin && (
            <Link to="/admin/users" onClick={() => setMenuOpen(false)} className="app-nav-admin">
              Administración
            </Link>
          )}
          {user && <span className="user-email">{user.email}</span>}
          <button type="button" onClick={() => logout()} className="btn-secondary">
            Salir
          </button>
        </nav>
      </header>
    </div>
  );
}
