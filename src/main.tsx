import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initPwaInstallCapture, registerServiceWorker } from '@/lib/pwa';
import { preparePublicMenuClient, shouldRegisterServiceWorker } from '@/lib/public-boot';
import App from './App';
import './index.css';

async function boot() {
  const publicBoot = await preparePublicMenuClient();
  if (publicBoot === 'reloading') return;

  // Captura beforeinstallprompt solo fuera de cartas públicas.
  if (shouldRegisterServiceWorker()) {
    initPwaInstallCapture();
    void registerServiceWorker();
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
