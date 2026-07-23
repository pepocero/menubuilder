import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ApiError, listMyQrs, unpublishMenu, type PublishedQr } from '@/lib/api';
import { AppLayout } from '@/components/AppLayout';
import {
  downloadQrPng,
  QR_ERROR_LEVEL,
  QR_PREVIEW_SIZE,
} from '@/lib/qr-download';

export function QrsPage() {
  const [menus, setMenus] = useState<PublishedQr[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  async function handleUnpublish(id: string) {
    if (!confirm('¿Despublicar esta carta? El QR dejará de funcionar.')) return;
    await unpublishMenu(id);
    await load();
  }

  function absoluteUrl(path: string): string {
    return `${window.location.origin}${path}`;
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
          Solo ves las cartas que tú has publicado. Nadie más puede gestionar tus QR. Para imprimir,
          descarga el PNG de alta calidad.
        </p>

        {loading && <p>Cargando...</p>}
        {error && <div className="error-banner">{error}</div>}

        {!loading && menus.length === 0 && (
          <div className="empty-state">
            <p>
              Aún no tienes cartas publicadas. Abre un menú en el editor y usa{' '}
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
            return (
              <article key={menu.id} className="qr-card">
                <div className="qr-card-code">
                  <QRCodeSVG
                    value={url}
                    size={Math.min(QR_PREVIEW_SIZE, 180)}
                    level={QR_ERROR_LEVEL}
                    includeMargin
                  />
                </div>
                <h3>{menu.title}</h3>
                <a href={menu.public_url} target="_blank" rel="noreferrer" className="qr-card-link">
                  {url}
                </a>
                <div className="qr-card-actions">
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
                  <a href={menu.public_url} target="_blank" rel="noreferrer" className="btn-secondary">
                    Ver pública
                  </a>
                  <button type="button" className="danger-btn" onClick={() => handleUnpublish(menu.id)}>
                    Despublicar
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
