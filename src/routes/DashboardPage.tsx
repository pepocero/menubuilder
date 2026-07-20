import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createMenu,
  deleteMenu,
  duplicateMenu,
  listMenus,
  type MenuSummary,
} from '@/lib/api';
import { AppLayout } from '@/components/AppLayout';

export function DashboardPage() {
  const navigate = useNavigate();
  const [menus, setMenus] = useState<MenuSummary[]>([]);
  const [loading, setLoading] = useState(true);
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
    const { menu } = await createMenu({ title: 'Nuevo menú' });
    navigate(`/editor/${menu.id}`);
  }

  async function handleDuplicate(id: string) {
    const { menu } = await duplicateMenu(id);
    await loadMenus();
    navigate(`/editor/${menu.id}`);
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este menú?')) return;
    await deleteMenu(id);
    await loadMenus();
  }

  return (
    <div className="dashboard-page">
      <AppLayout />
      <main className="dashboard-main">
        <div className="dashboard-header">
          <h1>Mis menús</h1>
          <div className="dashboard-actions">
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
            <p>Aún no tienes menús. Crea uno en blanco o elige una plantilla.</p>
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
