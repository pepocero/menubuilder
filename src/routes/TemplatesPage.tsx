import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ApiError,
  createMenu,
  deleteTemplate,
  listMyTemplates,
  listTemplates,
  publishTemplate,
  unpublishTemplate,
  updateMenu,
  type TemplateSummary,
} from '@/lib/api';
import { appAlert, appConfirm } from '@/lib/app-dialog';
import { useAuth } from '@/lib/auth-context';
import {
  describeTemplateContentIssues,
  hasTemplateContentIssues,
  scanTemplateContentForUser,
} from '@/lib/template-content-safety';
import { renderCanvasDataThumbnail, renderMobileDocumentThumbnail } from '@/lib/menu-thumbnail';
import { AppLayout } from '@/components/AppLayout';
import { DesktopMenuIcon, MobileMenuIcon } from '@/components/MenuKindIcons';
import { TemplatePreview } from '@/components/templates/TemplatePreview';

type TemplateKindFilter = 'all' | 'canvas' | 'mobile';

function isMobileTemplate(template: TemplateSummary): boolean {
  return template.editor_kind === 'mobile';
}

export function TemplatesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [publicTemplates, setPublicTemplates] = useState<TemplateSummary[]>([]);
  const [myTemplates, setMyTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [creating, setCreating] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<TemplateKindFilter>('all');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    let publicError = '';
    let mineError = '';

    try {
      const { templates } = await listTemplates();
      setPublicTemplates(templates);
    } catch (err) {
      publicError =
        err instanceof ApiError ? err.message : 'No se pudieron cargar las plantillas públicas';
      setPublicTemplates([]);
    }

    try {
      const { templates } = await listMyTemplates();
      setMyTemplates(templates);
    } catch {
      mineError = 'No se pudieron cargar tus plantillas';
      setMyTemplates([]);
    }

    if (publicError && mineError) {
      setLoadError(publicError);
    } else if (publicError) {
      setLoadError(publicError);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const myTemplateIds = useMemo(() => new Set(myTemplates.map((t) => t.id)), [myTemplates]);

  const allTemplates = useMemo(() => {
    const combined = [
      ...myTemplates,
      ...publicTemplates.filter((t) => !myTemplateIds.has(t.id)),
    ];
    return combined.sort((a, b) => {
      const aMine = myTemplateIds.has(a.id) ? 0 : 1;
      const bMine = myTemplateIds.has(b.id) ? 0 : 1;
      if (aMine !== bMine) return aMine - bMine;
      const aSystem = a.is_system || !a.user_id ? 0 : 1;
      const bSystem = b.is_system || !b.user_id ? 0 : 1;
      if (aSystem !== bSystem) return aSystem - bSystem;
      return a.name.localeCompare(b.name, 'es');
    });
  }, [myTemplates, publicTemplates, myTemplateIds]);

  const canvasTemplates = allTemplates.filter((t) => !isMobileTemplate(t));
  const mobileTemplates = allTemplates.filter((t) => isMobileTemplate(t));
  const visibleTemplates =
    kindFilter === 'all'
      ? allTemplates
      : kindFilter === 'mobile'
        ? mobileTemplates
        : canvasTemplates;

  async function handleUseTemplate(template: TemplateSummary) {
    const isMobile = isMobileTemplate(template);
    setCreating(template.id);
    try {
      const { menu } = await createMenu({
        title: template.name,
        template_id: template.id,
      });

      try {
        let thumbnail = menu.thumbnail_url ?? null;
        if (!thumbnail && isMobile && menu.mobile_document) {
          thumbnail = await renderMobileDocumentThumbnail(menu.mobile_document);
        } else if (!thumbnail && menu.canvas_data) {
          thumbnail = await renderCanvasDataThumbnail(menu.canvas_data);
        }
        if (thumbnail) {
          await updateMenu(menu.id, {
            thumbnail_url: thumbnail,
            ...(isMobile ? { editor_kind: 'mobile' as const } : {}),
          });
        }
      } catch {
        /* El menú ya está creado */
      }

      navigate(isMobile ? `/mobile-editor/${menu.id}` : `/editor/${menu.id}`);
    } finally {
      setCreating(null);
    }
  }

  async function handlePublish(template: TemplateSummary) {
    const scan = scanTemplateContentForUser(
      {
        canvas_data: template.canvas_data,
        mobile_document: template.mobile_document,
        thumbnail_url: template.thumbnail_url,
      },
      user?.email,
    );
    if (hasTemplateContentIssues(scan)) {
      const lines = describeTemplateContentIssues(scan);
      const confirmed = await appConfirm(
        `${lines.join('\n')}\n\n¿Publicar la plantilla de todos modos? El contenido personal se eliminará automáticamente.`,
        {
          title: 'Revisar plantilla',
          confirmText: 'Publicar',
        },
      );
      if (!confirmed) return;
    }

    setActionId(template.id);
    try {
      await publishTemplate(template.id);
      await loadAll();
    } catch (err) {
      await appAlert(err instanceof ApiError ? err.message : 'No se pudo publicar la plantilla');
    } finally {
      setActionId(null);
    }
  }

  async function handleUnpublish(template: TemplateSummary) {
    setActionId(template.id);
    try {
      await unpublishTemplate(template.id);
      await loadAll();
    } catch (err) {
      await appAlert(err instanceof ApiError ? err.message : 'No se pudo despublicar la plantilla');
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(template: TemplateSummary) {
    const confirmed = await appConfirm('¿Eliminar esta plantilla? No se puede deshacer.', {
      title: 'Eliminar plantilla',
      variant: 'danger',
      confirmText: 'Eliminar',
    });
    if (!confirmed) return;

    setActionId(template.id);
    try {
      await deleteTemplate(template.id);
      await loadAll();
    } catch (err) {
      await appAlert(err instanceof ApiError ? err.message : 'No se pudo eliminar la plantilla');
    } finally {
      setActionId(null);
    }
  }

  function renderPreview(template: TemplateSummary) {
    if (template.thumbnail_url) {
      return <img src={template.thumbnail_url} alt={template.name} />;
    }
    if (template.canvas_data) {
      return <TemplatePreview canvasData={template.canvas_data} name={template.name} />;
    }
    return <div className="template-preview-placeholder">{template.name}</div>;
  }

  function templateSourceLabel(template: TemplateSummary): string | null {
    if (myTemplateIds.has(template.id)) {
      return template.is_public ? 'Mi plantilla · Publicada' : 'Mi plantilla · Privada';
    }
    if (template.is_system || !template.user_id) return 'Sistema';
    if (template.author_name) return `Comunidad · ${template.author_name}`;
    return 'Comunidad';
  }

  function renderTemplateCard(template: TemplateSummary) {
    const isMobile = isMobileTemplate(template);
    const isMine = myTemplateIds.has(template.id);
    const busy = actionId === template.id;
    const source = templateSourceLabel(template);

    return (
      <article
        key={template.id}
        className={`template-card template-card--browse ${isMobile ? 'template-card--mobile' : 'template-card--canvas'}${isMine ? ' template-card--mine' : ''}`}
        aria-label={`${template.name}, plantilla ${isMobile ? 'móvil' : 'de escritorio'}`}
      >
        <div className="template-preview-wrap">
          <span
            className={`menu-card-kind-badge ${isMobile ? 'menu-card-kind-badge--mobile' : 'menu-card-kind-badge--canvas'}`}
            aria-hidden="true"
          >
            {isMobile ? <MobileMenuIcon /> : <DesktopMenuIcon />}
          </span>
          <div className="template-preview">{renderPreview(template)}</div>
        </div>
        <div className="template-card-body">
          <h3>{template.name}</h3>
          {template.is_premium && <span className="badge">Premium</span>}
          {source && <p className="template-source-label">{source}</p>}
          <button
            type="button"
            className={isMobile ? 'btn-dashboard-mobile' : 'btn-dashboard-canvas'}
            disabled={creating === template.id}
            onClick={() => handleUseTemplate(template)}
          >
            {creating === template.id ? 'Creando…' : 'Usar esta plantilla'}
          </button>
          {isMine && (
            <div className="template-card-actions template-card-actions--mine">
              {template.is_public ? (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => handleUnpublish(template)}
                >
                  Despublicar
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary template-btn-publish"
                  disabled={busy}
                  onClick={() => handlePublish(template)}
                >
                  Publicar
                </button>
              )}
              <button
                type="button"
                className="btn-secondary template-btn-danger"
                disabled={busy}
                onClick={() => handleDelete(template)}
              >
                Eliminar
              </button>
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <div className="templates-page">
      <AppLayout />
      <main className="templates-main">
        <h1>Plantillas</h1>
        <p>
          Elige una plantilla como punto de partida. Guarda las tuyas desde el editor de escritorio
          o móvil y publícalas para compartirlas con todos.
        </p>

        {loading && <p>Cargando plantillas...</p>}
        {loadError && <div className="error-banner">{loadError}</div>}

        {!loading && allTemplates.length > 0 && (
          <div
            className="dashboard-kind-filter templates-kind-filter"
            role="group"
            aria-label="Filtrar plantillas por tipo"
          >
            <button
              type="button"
              className={kindFilter === 'all' ? 'is-active' : undefined}
              aria-pressed={kindFilter === 'all'}
              onClick={() => setKindFilter('all')}
            >
              Todas
              <span className="dashboard-kind-filter-count">{allTemplates.length}</span>
            </button>
            <button
              type="button"
              className={`dashboard-kind-filter--canvas${kindFilter === 'canvas' ? ' is-active' : ''}`}
              aria-pressed={kindFilter === 'canvas'}
              onClick={() => setKindFilter('canvas')}
            >
              <DesktopMenuIcon />
              Escritorio
              <span className="dashboard-kind-filter-count">{canvasTemplates.length}</span>
            </button>
            <button
              type="button"
              className={`dashboard-kind-filter--mobile${kindFilter === 'mobile' ? ' is-active' : ''}`}
              aria-pressed={kindFilter === 'mobile'}
              onClick={() => setKindFilter('mobile')}
            >
              <MobileMenuIcon />
              Móvil
              <span className="dashboard-kind-filter-count">{mobileTemplates.length}</span>
            </button>
          </div>
        )}

        {!loading && allTemplates.length === 0 && !loadError && (
          <div className="empty-state">
            <p>
              No hay plantillas disponibles. Crea la tuya desde el editor clásico{' '}
              (<strong>Archivo → Guardar como plantilla</strong>) o el editor móvil (
              <strong>Guardar plantilla</strong>).
            </p>
          </div>
        )}

        {!loading && allTemplates.length > 0 && visibleTemplates.length === 0 && (
          <div className="empty-state">
            <p>
              No hay plantillas{' '}
              {kindFilter === 'mobile' ? 'móviles' : 'de escritorio'} con este filtro.
            </p>
          </div>
        )}

        {!loading && visibleTemplates.length > 0 && (
          <div className="template-grid">{visibleTemplates.map(renderTemplateCard)}</div>
        )}
      </main>
    </div>
  );
}
