import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ApiError,
  publishMenu,
  removeMenuPublic,
  unpublishMenu,
} from '@/lib/api';
import { appConfirm } from '@/lib/app-dialog';
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
  const hasLink = Boolean(publicUrl);

  async function handlePublish() {
    setBusy(true);
    setError('');
    try {
      const result = await publishMenu(menuId);
      setSlug(result.public_slug);
      setIsPublic(true);
      onStatusChange(true, result.public_slug);
      if (result.reused_slug) {
        setToast('Enlace reactivado (mismo QR)');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo publicar');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnpublish() {
    const confirmed = await appConfirm(
      '¿Despublicar esta carta?\n\nEl enlace quedará inactivo (quien escanee el QR no verá la carta), pero se conservan el enlace y el QR. Al publicar de nuevo se reutiliza el mismo enlace.',
      {
        title: 'Despublicar carta',
        variant: 'warning',
        confirmText: 'Despublicar',
      },
    );
    if (!confirmed) return;
    setBusy(true);
    setError('');
    try {
      const result = await unpublishMenu(menuId);
      setIsPublic(false);
      setSlug(result.public_slug);
      onStatusChange(false, result.public_slug);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo despublicar');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemovePublic() {
    const confirmed = await appConfirm(
      '¿Eliminar el enlace y el QR?\n\nSe borrará el enlace público y la imagen asociada. Los QR impresos dejarán de servir aunque vuelvas a publicar (se creará un enlace nuevo).',
      {
        title: 'Eliminar enlace público',
        variant: 'danger',
        confirmText: 'Eliminar',
      },
    );
    if (!confirmed) return;
    setBusy(true);
    setError('');
    try {
      await removeMenuPublic(menuId);
      setIsPublic(false);
      setSlug(null);
      onStatusChange(false, null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la publicación');
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

          {!hasLink ? (
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
              {!isPublic && (
                <div className="qr-status-banner qr-status-banner--inactive" role="status">
                  Enlace inactivo — el QR se conserva. Publícala de nuevo para reactivar el mismo
                  enlace.
                </div>
              )}
              <div className={`qr-preview${isPublic ? '' : ' qr-preview--inactive'}`}>
                <QRCodeSVG
                  id="menu-qr-svg"
                  value={publicUrl!}
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
                {!isPublic ? (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy}
                    onClick={handlePublish}
                  >
                    {busy ? 'Publicando...' : 'Publicar (mismo enlace)'}
                  </button>
                ) : null}
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
                {isPublic ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={handleUnpublish}
                  >
                    Despublicar
                  </button>
                ) : null}
                <button
                  type="button"
                  className="danger-btn"
                  disabled={busy}
                  onClick={handleRemovePublic}
                >
                  Eliminar
                </button>
              </div>
              <p className="panel-hint">
                <strong>Despublicar</strong> deja el enlace inactivo pero conserva el QR.{' '}
                <strong>Eliminar</strong> borra el enlace y la imagen asociada; al publicar de
                nuevo se crea un enlace distinto. Para imprimir usa{' '}
                <strong>Descargar PNG (alta calidad)</strong> (1024×1024).
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
