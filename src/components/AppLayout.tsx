import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { appAlert } from '@/lib/app-dialog';
import {
  getDeferredInstallPrompt,
  isStandaloneDisplay,
  promptPwaInstall,
  subscribeInstallPrompt,
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
  const [canNativeInstall, setCanNativeInstall] = useState(
    () => !!getDeferredInstallPrompt(),
  );
  const [installBusy, setInstallBusy] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const syncInstalled = () => setInstalled(isStandaloneDisplay());
    syncInstalled();

    if (isStandaloneDisplay()) return;

    const unsubscribe = subscribeInstallPrompt((event: BeforeInstallPromptEvent | null) => {
      setCanNativeInstall(!!event);
    });

    const onInstalled = () => {
      setInstalled(true);
      setCanNativeInstall(false);
    };
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
      unsubscribe();
      window.removeEventListener('appinstalled', onInstalled);
      for (const mq of mediaQueries) {
        mq.removeEventListener('change', syncInstalled);
      }
    };
  }, []);

  // Si ya está instalada, ocultar. Si no, mostrar (en Chromium el clic abre el diálogo nativo).
  const showInstall = !installed;

  async function handleInstallClick() {
    if (installBusy) return;
    setInstallBusy(true);
    try {
      const outcome = await promptPwaInstall();
      if (outcome === 'accepted') {
        setInstalled(true);
        setCanNativeInstall(false);
        return;
      }
      if (outcome === 'dismissed') {
        setCanNativeInstall(false);
        return;
      }
      if (outcome === 'ios') {
        await appAlert(
          'En iPhone/iPad Safari no permite instalar desde un botón. Toca Compartir (□↑) y elige «Añadir a pantalla de inicio».',
          {
            title: 'Instalar en el iPhone',
            confirmText: 'Entendido',
          },
        );
        return;
      }
      // unavailable: el navegador aún no expone el prompt (criterios PWA / ya instalada en otro perfil)
      await appAlert(
        canNativeInstall
          ? 'No se pudo abrir el instalador. Recarga la página e inténtalo de nuevo.'
          : 'El navegador aún no está listo para instalar. Espera unos segundos, recarga con Chrome/Edge y vuelve a pulsar Instalar. Si ya la instalaste antes, ábrela desde la pantalla de inicio.',
        {
          title: 'Instalar Paper To Menu',
          confirmText: 'Entendido',
        },
      );
    } finally {
      setInstallBusy(false);
    }
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
              disabled={installBusy}
              onClick={() => void handleInstallClick()}
              title="Instalar Paper To Menu en este dispositivo"
            >
              <InstallIcon />
              {installBusy ? 'Instalando…' : 'Instalar'}
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
