import { useEffect, useState, type ReactNode } from 'react';
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
import { absoluteUrl } from '@/lib/seo';

interface PublishQrModalProps {
  open: boolean;
  menuId: string;
  menuTitle: string;
  initialSlug: string | null;
  initialPublic: boolean;
  onClose: () => void;
  onStatusChange: (isPublic: boolean, slug: string | null) => void;
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
    </svg>
  );
}

function PublishIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 4v2h14V4H5zm0 10h3v6h8v-6h3l-7-7-7 7z"
      />
    </svg>
  );
}

function UnpublishIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 6.5c3.79 0 7.17 2.13 8.82 5.5-.59 1.22-1.42 2.27-2.41 3.12l1.41 1.41c1.39-1.23 2.49-2.77 3.18-4.53C21.27 7.11 17 4 12 4c-1.27 0-2.49.2-3.64.57l1.65 1.65C10.66 6.09 11.32 6.5 12 6.5zm-1.07 1.14L13 9.71c.57.25 1.03.71 1.28 1.28l2.07 2.07c.08-.34.15-.68.15-1.06 0-2.48-2.02-4.5-4.5-4.5-.38 0-.72.07-1.07.14zM2.71 3.16 1.3 4.57l2.38 2.38C2.06 8.37 1.05 10.11.5 12.01 2.73 16.89 7 20 12 20c1.52 0 2.97-.3 4.31-.82l2.18 2.18 1.41-1.41L2.71 3.16zM12 17.5c-3.79 0-7.17-2.13-8.82-5.5.64-1.32 1.6-2.47 2.77-3.35l2.2 2.2c-.23.4-.35.86-.35 1.35 0 1.93 1.57 3.5 3.5 3.5.49 0 .95-.12 1.35-.35l1.62 1.62c-.72.28-1.5.43-2.27.43z"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v10h-2V9zm4 0h2v10h-2V9zM7 9h2v10H7V9z"
      />
    </svg>
  );
}

function ActionBtn({
  className,
  disabled,
  onClick,
  title,
  ariaLabel,
  children,
}: {
  className: string;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
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
  const publicUrl = publicPath ? absoluteUrl(publicPath) : null;
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
          <h2>QR — {menuTitle}</h2>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="qr-modal-body">
          {error && <div className="error-banner">{error}</div>}

          {!hasLink ? (
            <div className="qr-empty">
              <p>Publica la carta para generar el enlace y el código QR.</p>
              <button
                type="button"
                className="btn-primary qr-action-btn"
                disabled={busy}
                onClick={() => void handlePublish()}
              >
                <PublishIcon />
                {busy ? 'Publicando…' : 'Publicar'}
              </button>
            </div>
          ) : (
            <>
              {!isPublic && (
                <div className="qr-status-banner qr-status-banner--inactive" role="status">
                  Enlace inactivo — el QR se conserva.
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
                  <ActionBtn
                    className="btn-primary qr-action-btn"
                    disabled={busy}
                    onClick={() => void handlePublish()}
                    title="Publicar de nuevo (mismo enlace y QR)"
                    ariaLabel={busy ? 'Publicando' : 'Publicar'}
                  >
                    <PublishIcon />
                    {busy ? '…' : 'Publicar'}
                  </ActionBtn>
                ) : null}
                <ActionBtn
                  className="btn-secondary qr-action-btn"
                  onClick={() => void copyLink()}
                  title="Copiar enlace"
                  ariaLabel="Copiar enlace"
                >
                  <CopyIcon />
                  Copiar
                </ActionBtn>
                <ActionBtn
                  className="btn-primary qr-action-btn"
                  disabled={downloading}
                  onClick={() => void handleDownloadPng()}
                  title="Descargar PNG 1024×1024 (impresión)"
                  ariaLabel={downloading ? 'Descargando PNG' : 'Descargar PNG'}
                >
                  <DownloadIcon />
                  PNG
                </ActionBtn>
                <ActionBtn
                  className="btn-secondary qr-action-btn"
                  disabled={downloading}
                  onClick={() => void handleDownloadSvg()}
                  title="Descargar SVG vectorial"
                  ariaLabel={downloading ? 'Descargando SVG' : 'Descargar SVG'}
                >
                  <DownloadIcon />
                  SVG
                </ActionBtn>
                {isPublic ? (
                  <ActionBtn
                    className="btn-secondary qr-action-btn"
                    disabled={busy}
                    onClick={() => void handleUnpublish()}
                    title="Despublicar: oculta la carta y conserva el QR"
                    ariaLabel="Despublicar"
                  >
                    <UnpublishIcon />
                    Ocultar
                  </ActionBtn>
                ) : null}
                <ActionBtn
                  className="danger-btn qr-action-btn qr-action-btn--icon"
                  disabled={busy}
                  onClick={() => void handleRemovePublic()}
                  title="Eliminar enlace y QR"
                  ariaLabel="Eliminar enlace y QR"
                >
                  <TrashIcon />
                </ActionBtn>
              </div>
              <p className="panel-hint qr-modal-hint">
                Ocultar conserva el QR. La papelera borra el enlace.
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
