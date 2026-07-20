import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ApiError, publishMenu, unpublishMenu } from '@/lib/api';

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
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setSlug(initialSlug);
      setIsPublic(initialPublic);
      setError('');
    }
  }, [open, initialSlug, initialPublic]);

  if (!open) return null;

  const publicPath = slug ? `/p/${slug}` : null;
  const publicUrl = publicPath ? `${window.location.origin}${publicPath}` : null;

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
    if (!confirm('¿Despublicar esta carta? El QR dejará de funcionar.')) return;
    setBusy(true);
    setError('');
    try {
      await unpublishMenu(menuId);
      setIsPublic(false);
      onStatusChange(false, slug);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo despublicar');
    } finally {
      setBusy(false);
    }
  }

  function downloadQr() {
    const svg = document.getElementById('menu-qr-svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${slug || menuId}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
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
                <QRCodeSVG id="menu-qr-svg" value={publicUrl} size={220} level="M" includeMargin />
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
                <button type="button" className="btn-secondary" onClick={downloadQr}>
                  Descargar QR
                </button>
                <button type="button" className="btn-primary" disabled={busy} onClick={handlePublish}>
                  Regenerar
                </button>
                <button type="button" className="danger-btn" disabled={busy} onClick={handleUnpublish}>
                  Despublicar
                </button>
              </div>
              <p className="panel-hint">
                Solo tú puedes gestionar este QR. Otros usuarios no ven ni controlan tus cartas
                publicadas.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
