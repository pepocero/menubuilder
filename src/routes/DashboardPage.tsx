import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ApiError,
  createMenu,
  deleteMenu,
  duplicateMenu,
  getMenu,
  listMenus,
  updateMenu,
  type MenuSummary,
} from '@/lib/api';
import { parseMenuImportFile } from '@/lib/export';
import {
  renderCanvasDataThumbnail,
  renderMobileDocumentThumbnail,
  withImportedMenuTitle,
} from '@/lib/menu-thumbnail';
import { createDefaultMobileMenuDocument } from '@shared/mobile-menu';
import { AppLayout } from '@/components/AppLayout';
import { DesktopMenuIcon, MobileMenuIcon } from '@/components/MenuKindIcons';
import { appConfirm } from '@/lib/app-dialog';

type MenuKindFilter = 'all' | 'canvas' | 'mobile';

export function DashboardPage() {
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [menus, setMenus] = useState<MenuSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<MenuKindFilter>('all');
  const backfillRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Genera miniaturas faltantes y regenera las de cartas móviles (para incluir imágenes).
  useEffect(() => {
    if (loading) return;
    let mobileRefreshDone = false;
    try {
      mobileRefreshDone = sessionStorage.getItem('mb.mobileThumb.images.v1') === '1';
    } catch {
      mobileRefreshDone = false;
    }
    const missing = menus.filter((m) => {
      if (backfillRef.current.has(m.id)) return false;
      if (!m.thumbnail_url) return true;
      return m.editor_kind === 'mobile' && !mobileRefreshDone;
    });
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      let refreshedMobile = false;
      for (const item of missing) {
        if (cancelled) return;
        backfillRef.current.add(item.id);
        try {
          const { menu } = await getMenu(item.id);
          let thumbnail: string | null = null;
          if (menu.editor_kind === 'mobile' && menu.mobile_document) {
            thumbnail = await renderMobileDocumentThumbnail(menu.mobile_document);
            refreshedMobile = true;
          } else if (menu.canvas_data) {
            thumbnail = await renderCanvasDataThumbnail(menu.canvas_data);
          }
          if (!thumbnail || cancelled) continue;
          await updateMenu(menu.id, {
            thumbnail_url: thumbnail,
            editor_kind: menu.editor_kind,
          });
          if (cancelled) return;
          setMenus((prev) =>
            prev.map((m) => (m.id === menu.id ? { ...m, thumbnail_url: thumbnail } : m)),
          );
        } catch {
          /* Si falla, se reintentará en otra visita o al guardar en el editor */
        }
      }
      if (!cancelled && refreshedMobile) {
        try {
          sessionStorage.setItem('mb.mobileThumb.images.v1', '1');
        } catch {
          /* ignore */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, menus]);

  async function handleNewBlank() {
    setError('');
    try {
      const { menu } = await createMenu({ title: 'Nuevo menú' });
      navigate(`/editor/${menu.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el menú');
    }
  }

  async function handleNewMobile() {
    setError('');
    try {
      const mobileDoc = createDefaultMobileMenuDocument();
      const { menu } = await createMenu({
        title: 'Nueva carta móvil',
        editor_kind: 'mobile',
        mobile_document: mobileDoc,
      });
      try {
        const thumbnail = await renderMobileDocumentThumbnail(mobileDoc);
        if (thumbnail) {
          await updateMenu(menu.id, {
            thumbnail_url: thumbnail,
            editor_kind: 'mobile',
            mobile_document: mobileDoc,
          });
        }
      } catch {
        /* La carta ya está creada */
      }
      navigate(`/mobile-editor/${menu.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la carta móvil');
    }
  }

  async function handleImportMenuFile(file: File) {
    if (importing) return;
    setImporting(true);
    setError('');
    try {
      const parsed = await parseMenuImportFile(file);
      const fromName = file.name.replace(/\.json$/i, '').trim();
      const baseTitle =
        parsed.title ||
        (fromName && fromName !== 'menu' ? fromName : '') ||
        'Menú';
      const title = withImportedMenuTitle(baseTitle);

      if (parsed.kind === 'mobile') {
        const { menu } = await createMenu({
          title,
          editor_kind: 'mobile',
          mobile_document: parsed.document,
        });
        try {
          const thumbnail = await renderMobileDocumentThumbnail(parsed.document);
          if (thumbnail) {
            await updateMenu(menu.id, {
              thumbnail_url: thumbnail,
              editor_kind: 'mobile',
              mobile_document: parsed.document,
            });
          }
        } catch {
          /* La importación ya OK; el preview puede generarse al guardar en el editor */
        }
        navigate(`/mobile-editor/${menu.id}`);
        return;
      }

      const { menu } = await createMenu({ title, canvas_data: parsed.canvas });

      try {
        const thumbnail = await renderCanvasDataThumbnail(parsed.canvas);
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
      setMenus((prev) => [menu, ...prev.filter((m) => m.id !== menu.id)]);
      setToast(`Copia creada: ${menu.title}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo duplicar el menú');
    }
  }

  async function handleDelete(id: string) {
    const confirmed = await appConfirm('¿Eliminar este menú?', {
      title: 'Eliminar menú',
      variant: 'danger',
      confirmText: 'Eliminar',
    });
    if (!confirmed) return;
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

  const canvasMenus = menus.filter((m) => m.editor_kind !== 'mobile');
  const mobileMenus = menus.filter((m) => m.editor_kind === 'mobile');
  const visibleMenus =
    kindFilter === 'all'
      ? menus
      : kindFilter === 'mobile'
        ? mobileMenus
        : canvasMenus;

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
              Plantillas
            </Link>
            <button type="button" className="btn-dashboard-canvas" onClick={handleNewBlank}>
              Nuevo menú en blanco
            </button>
            <button type="button" className="btn-dashboard-mobile" onClick={handleNewMobile}>
              Nueva carta móvil
            </button>
          </div>
        </div>

        {!loading && menus.length > 0 && (
          <div
            className="dashboard-kind-filter"
            role="group"
            aria-label="Filtrar por tipo de carta"
          >
            <button
              type="button"
              className={kindFilter === 'all' ? 'is-active' : undefined}
              aria-pressed={kindFilter === 'all'}
              onClick={() => setKindFilter('all')}
            >
              Todas
              <span className="dashboard-kind-filter-count">{menus.length}</span>
            </button>
            <button
              type="button"
              className={`dashboard-kind-filter--canvas${kindFilter === 'canvas' ? ' is-active' : ''}`}
              aria-pressed={kindFilter === 'canvas'}
              onClick={() => setKindFilter('canvas')}
            >
              <DesktopMenuIcon />
              Escritorio
              <span className="dashboard-kind-filter-count">{canvasMenus.length}</span>
            </button>
            <button
              type="button"
              className={`dashboard-kind-filter--mobile${kindFilter === 'mobile' ? ' is-active' : ''}`}
              aria-pressed={kindFilter === 'mobile'}
              onClick={() => setKindFilter('mobile')}
            >
              <MobileMenuIcon />
              Móvil
              <span className="dashboard-kind-filter-count">{mobileMenus.length}</span>
            </button>
          </div>
        )}

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

        {!loading && menus.length > 0 && visibleMenus.length === 0 && (
          <div className="empty-state">
            <p>
              No hay cartas{' '}
              {kindFilter === 'mobile' ? 'móviles' : 'del editor de escritorio'} con este filtro.
            </p>
          </div>
        )}

        <div className="menu-grid">
          {visibleMenus.map((menu) => {
            const isMobile = menu.editor_kind === 'mobile';
            return (
            <article
              key={menu.id}
              className={`menu-card ${isMobile ? 'menu-card--mobile' : 'menu-card--canvas'}`}
              aria-label={`${menu.title}, carta ${isMobile ? 'móvil' : 'de escritorio'}`}
            >
              <Link
                to={isMobile ? `/mobile-editor/${menu.id}` : `/editor/${menu.id}`}
                className="menu-card-link"
              >
                <span
                  className={`menu-card-kind-badge ${isMobile ? 'menu-card-kind-badge--mobile' : 'menu-card-kind-badge--canvas'}`}
                  aria-hidden="true"
                >
                  {isMobile ? <MobileMenuIcon /> : <DesktopMenuIcon />}
                </span>
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
            );
          })}
        </div>
      </main>
      {toast && (
        <div className="app-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
