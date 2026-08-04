import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  ApiError,
  listMyQrs,
  publishMenu,
  removeMenuPublic,
  unpublishMenu,
  type PublishedQr,
} from '@/lib/api';
import { AppLayout } from '@/components/AppLayout';
import { appConfirm } from '@/lib/app-dialog';
import {
  downloadQrPng,
  QR_ERROR_LEVEL,
  QR_PREVIEW_SIZE,
} from '@/lib/qr-download';
import { absoluteUrl } from '@/lib/seo';

export function QrsPage() {
  const [menus, setMenus] = useState<PublishedQr[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { menus: data } = await listMyQrs();
      setMenus(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus QR');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePublish(id: string) {
    setBusyId(id);
    setError('');
    try {
      await publishMenu(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo publicar');
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnpublish(id: string) {
    const confirmed = await appConfirm(
      '¿Despublicar esta carta?\n\nEl enlace quedará inactivo, pero se conservan el enlace y el QR. Al publicar de nuevo se reutiliza el mismo enlace.',
      {
        title: 'Despublicar carta',
        variant: 'warning',
        confirmText: 'Despublicar',
      },
    );
    if (!confirmed) return;
    setBusyId(id);
    setError('');
    try {
      await unpublishMenu(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo despublicar');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemovePublic(id: string) {
    const confirmed = await appConfirm(
      '¿Eliminar el enlace y el QR?\n\nSe borrará el enlace público y la imagen asociada. Los QR impresos dejarán de servir; al publicar de nuevo se creará un enlace nuevo.',
      {
        title: 'Eliminar enlace público',
        variant: 'danger',
        confirmText: 'Eliminar',
      },
    );
    if (!confirmed) return;
    setBusyId(id);
    setError('');
    try {
      await removeMenuPublic(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la publicación');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownloadPng(menu: PublishedQr) {
    const url = absoluteUrl(menu.public_url);
    setDownloadingId(menu.id);
    setError('');
    try {
      await downloadQrPng(url, `qr-${menu.public_slug || menu.id}`);
    } catch {
      setError('No se pudo descargar el QR en PNG');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="qrs-page">
      <AppLayout />
      <main className="templates-main">
        <h1>Mis códigos QR</h1>
        <p>
          Solo ves las cartas que tú has publicado (activas o despublicadas). Nadie más puede
          gestionar tus QR. <strong>Despublicar</strong> desactiva el enlace sin borrar el QR;{' '}
          <strong>Eliminar</strong> borra enlace e imagen.
        </p>

        {loading && <p>Cargando...</p>}
        {error && <div className="error-banner">{error}</div>}

        {!loading && menus.length === 0 && (
          <div className="empty-state">
            <p>
              Aún no tienes cartas con QR. Abre un menú en el editor y usa{' '}
              <strong>QR / Publicar</strong>.
            </p>
            <Link to="/dashboard" className="btn-primary">
              Ir a mis menús
            </Link>
          </div>
        )}

        <div className="qr-grid">
          {menus.map((menu) => {
            const url = absoluteUrl(menu.public_url);
            const busy = busyId === menu.id;
            return (
              <article
                key={menu.id}
                className={`qr-card${menu.is_public ? '' : ' qr-card--inactive'}`}
              >
                <div className="qr-card-code">
                  <QRCodeSVG
                    value={url}
                    size={Math.min(QR_PREVIEW_SIZE, 180)}
                    level={QR_ERROR_LEVEL}
                    includeMargin
                  />
                </div>
                <div className="qr-card-header">
                  <h3>{menu.title}</h3>
                  <span
                    className={
                      menu.is_public
                        ? 'qr-status-pill qr-status-pill--active'
                        : 'qr-status-pill qr-status-pill--inactive'
                    }
                  >
                    {menu.is_public ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <a href={url} target="_blank" rel="noreferrer" className="qr-card-link">
                  {url}
                </a>
                <div className="qr-card-actions">
                  {!menu.is_public ? (
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busy}
                      onClick={() => void handlePublish(menu.id)}
                    >
                      {busy ? '…' : 'Publicar'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={downloadingId === menu.id}
                    onClick={() => void handleDownloadPng(menu)}
                  >
                    {downloadingId === menu.id ? 'Descargando…' : 'Descargar PNG'}
                  </button>
                  <Link to={`/editor/${menu.id}`} className="btn-secondary">
                    Editar
                  </Link>
                  {menu.is_public ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary"
                    >
                      Ver pública
                    </a>
                  ) : null}
                  {menu.is_public ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() => void handleUnpublish(menu.id)}
                    >
                      Despublicar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="danger-btn"
                    disabled={busy}
                    onClick={() => void handleRemovePublic(menu.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
