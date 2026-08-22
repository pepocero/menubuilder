import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initPwaInstallCapture, registerServiceWorker } from '@/lib/pwa';
import {
  cleanupPublicMenuClientInBackground,
  clearPublicBootPlaceholder,
  isPublicMenuPath,
  shouldRegisterServiceWorker,
} from '@/lib/public-boot';
import App from './App';
import './index.css';

function mountApp() {
  const rootEl = document.getElementById('root');
  if (!rootEl) return;
  clearPublicBootPlaceholder();
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

function boot() {
  const isPublic = isPublicMenuPath();

  if (isPublic) {
    // QR móvil: montar React al instante; limpiar SW sin bloquear ni recargar.
    mountApp();
    cleanupPublicMenuClientInBackground();
    return;
  }

  if (shouldRegisterServiceWorker()) {
    initPwaInstallCapture();
    void registerServiceWorker();
  }

  mountApp();
}

boot();
