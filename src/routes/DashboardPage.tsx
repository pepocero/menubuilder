import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ApiError,
  createMenu,
  deleteMenu,
  duplicateMenu,
  listMenus,
  updateMenu,
  type MenuSummary,
} from '@/lib/api';
import { parseMenuImportFile } from '@/lib/export';
import {
  renderCanvasDataThumbnail,
  withImportedMenuTitle,
} from '@/lib/menu-thumbnail';
import { AppLayout } from '@/components/AppLayout';

export function DashboardPage() {
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [menus, setMenus] = useState<MenuSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const loadMenus = useCallback(async () => {
    try {
      const { menus: data } = await listMenus();
      setMenus(data);
    } catch {
      setError('No se pudieron cargar los menús');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenus();
  }, [loadMenus]);

  async function handleNewBlank() {
    setError('');
    try {
      const { menu } = await createMenu({ title: 'Nuevo menú' });
      navigate(`/editor/${menu.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el menú');
    }
  }

  async function handleImportMenuFile(file: File) {
    if (importing) return;
    setImporting(true);
    setError('');
    try {
      const { canvas, title: docTitle } = await parseMenuImportFile(file);
      const fromName = file.name.replace(/\.json$/i, '').trim();
      const baseTitle =
        docTitle ||
        (fromName && fromName !== 'menu' ? fromName : '') ||
        'Menú';
      const title = withImportedMenuTitle(baseTitle);

      const { menu } = await createMenu({ title, canvas_data: canvas });

      // Miniatura para la tarjeta de Mis menús (create no genera preview).
      try {
        const thumbnail = await renderCanvasDataThumbnail(canvas);
        if (thumbnail) {
          await updateMenu(menu.id, { thumbnail_url: thumbnail });
        }
      } catch {
        /* La importación ya OK; el preview puede generarse al guardar en el editor */
      }

      navigate(`/editor/${menu.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo importar el menú desde el archivo',
      );
    } finally {
      setImporting(false);
    }
  }

  function handleImportInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void handleImportMenuFile(file);
  }

  async function handleDuplicate(id: string) {
    setError('');
    try {
      const { menu } = await duplicateMenu(id);
      await loadMenus();
      navigate(`/editor/${menu.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo duplicar el menú');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este menú?')) return;
    setError('');
    try {
      await deleteMenu(id);
      setMenus((prev) => prev.filter((m) => m.id !== id));
      await loadMenus();
    } catch (err) {
      // Si el menú ya se borró en BD pero falló la limpieza, no mostrar error falso.
      try {
        const { menus: data } = await listMenus();
        setMenus(data);
        if (!data.some((m) => m.id === id)) {
          setError('');
          return;
        }
      } catch {
        /* mantener el error original */
      }
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el menú');
    }
  }

  return (
    <div className="dashboard-page">
      <AppLayout />
      <main className="dashboard-main">
        <div className="dashboard-header">
          <h1>Mis menús</h1>
          <div className="dashboard-actions">
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={handleImportInputChange}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={importing}
              onClick={() => importInputRef.current?.click()}
              title="Crear un menú nuevo a partir de un menu.json exportado"
            >
              {importing ? 'Importando…' : 'Importar menú'}
            </button>
            <Link to="/templates" className="btn-secondary">
              Desde plantilla
            </Link>
            <button type="button" className="btn-primary" onClick={handleNewBlank}>
              Nuevo menú en blanco
            </button>
          </div>
        </div>

        {loading && <p>Cargando menús...</p>}
        {error && <div className="error-banner">{error}</div>}

        {!loading && menus.length === 0 && (
          <div className="empty-state">
            <p>
              Aún no tienes menús. Crea uno en blanco, elige una plantilla o importa un
              menu.json.
            </p>
          </div>
        )}

        <div className="menu-grid">
          {menus.map((menu) => (
            <article key={menu.id} className="menu-card">
              <Link to={`/editor/${menu.id}`} className="menu-card-link">
                <div className="menu-thumbnail">
                  {menu.thumbnail_url ? (
                    <img src={menu.thumbnail_url} alt={menu.title} />
                  ) : (
                    <div className="menu-thumbnail-placeholder">Sin vista previa</div>
                  )}
                </div>
                <h3>{menu.title}</h3>
                <time>{new Date(menu.updated_at).toLocaleDateString('es-ES')}</time>
              </Link>
              <div className="menu-card-actions">
                <button type="button" onClick={() => handleDuplicate(menu.id)}>
                  Duplicar
                </button>
                <button type="button" className="danger" onClick={() => handleDelete(menu.id)}>
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
