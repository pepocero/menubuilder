import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initPwaInstallCapture, registerServiceWorker } from '@/lib/pwa';
import App from './App';
import './index.css';

// Antes de montar React: si no, beforeinstallprompt se pierde.
initPwaInstallCapture();
void registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
