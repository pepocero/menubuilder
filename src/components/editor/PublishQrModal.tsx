import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ApiError, publishMenu, unpublishMenu } from '@/lib/api';
import {
  downloadQrPng,
  downloadQrSvg,
  QR_ERROR_LEVEL,
  QR_PREVIEW_SIZE,
} from '@/lib/qr-download';

interface PublishQrModalProps {
  open: boolean;
  menuId: string;
  menuTitle: string;
  initialSlug: string | null;
  initialPublic: boolean;
  onClose: () => void;
  onStatusChange: (isPublic: boolean, slug: string | null) => void;
}

export function PublishQrModal({
  open,
  menuId,
  menuTitle,
  initialSlug,
  initialPublic,
  onClose,
  onStatusChange,
}: PublishQrModalProps) {
  const [slug, setSlug] = useState(initialSlug);
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSlug(initialSlug);
      setIsPublic(initialPublic);
      setError('');
      setToast(null);
    }
  }, [open, initialSlug, initialPublic]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!open) return null;

  const publicPath = slug ? `/p/${slug}` : null;
  const publicUrl = publicPath ? `${window.location.origin}${publicPath}` : null;
  const filenameBase = `qr-${slug || menuId}`;

  async function handlePublish() {
    setBusy(true);
    setError('');
    try {
      const result = await publishMenu(menuId);
      setSlug(result.public_slug);
      setIsPublic(true);
      onStatusChange(true, result.public_slug);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo publicar');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnpublish() {
    if (
      !confirm(
        '¿Despublicar esta carta?\n\nEl enlace y el QR actuales dejarán de funcionar. Al volver a publicar se creará un enlace nuevo.',
      )
    ) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await unpublishMenu(menuId);
      setIsPublic(false);
      setSlug(null);
      onStatusChange(false, null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo despublicar');
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadPng() {
    if (!publicUrl) return;
    setDownloading(true);
    setError('');
    try {
      await downloadQrPng(publicUrl, filenameBase);
    } catch {
      setError('No se pudo descargar el QR en PNG');
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadSvg() {
    if (!publicUrl) return;
    setDownloading(true);
    setError('');
    try {
      await downloadQrSvg(publicUrl, filenameBase);
    } catch {
      setError('No se pudo descargar el QR en SVG');
    } finally {
      setDownloading(false);
    }
  }

  async function copyLink() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setToast('Enlace copiado');
    } catch {
      setError('No se pudo copiar el enlace');
    }
  }

  return (
    <div className="stock-modal-overlay" onClick={onClose}>
      <div className="stock-modal qr-modal" onClick={(e) => e.stopPropagation()}>
        <header className="stock-modal-header">
          <h2>Código QR — {menuTitle}</h2>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="qr-modal-body">
          {error && <div className="error-banner">{error}</div>}

          {!isPublic || !publicUrl ? (
            <div className="qr-empty">
              <p>
                Publica esta carta para generar un enlace y un código QR. Cualquiera que lo escanee
                podrá verla (solo lectura).
              </p>
              <button type="button" className="btn-primary" disabled={busy} onClick={handlePublish}>
                {busy ? 'Publicando...' : 'Publicar y generar QR'}
              </button>
            </div>
          ) : (
            <>
              <div className="qr-preview">
                <QRCodeSVG
                  id="menu-qr-svg"
                  value={publicUrl}
                  size={QR_PREVIEW_SIZE}
                  level={QR_ERROR_LEVEL}
                  includeMargin
                />
              </div>
              <p className="qr-link">
                <a href={publicPath!} target="_blank" rel="noreferrer">
                  {publicUrl}
                </a>
              </p>
              <div className="qr-actions">
                <button type="button" className="btn-secondary" onClick={copyLink}>
                  Copiar enlace
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={downloading}
                  onClick={() => void handleDownloadPng()}
                  title="PNG 1024×1024 — ideal para imprimir"
                >
                  {downloading ? 'Descargando…' : 'Descargar PNG (alta calidad)'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={downloading}
                  onClick={() => void handleDownloadSvg()}
                  title="SVG vectorial 1024×1024"
                >
                  Descargar SVG
                </button>
                <button type="button" className="danger-btn" disabled={busy} onClick={handleUnpublish}>
                  Despublicar
                </button>
              </div>
              <p className="panel-hint">
                Para imprimir usa <strong>Descargar PNG (alta calidad)</strong> (1024×1024). La
                miniatura del modal es solo vista previa. El enlace del QR no cambia mientras la
                carta siga publicada.
              </p>
            </>
          )}
        </div>
      </div>
      {toast && (
        <div className="app-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
