import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createMenu, listTemplates, updateMenu, type TemplateSummary } from '@/lib/api';
import { renderCanvasDataThumbnail } from '@/lib/menu-thumbnail';
import { AppLayout } from '@/components/AppLayout';
import { TemplatePreview } from '@/components/templates/TemplatePreview';

export function TemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const { templates: data } = await listTemplates();
      setTemplates(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  async function handleUseTemplate(template: TemplateSummary) {
    setCreating(template.id);
    try {
      const { menu } = await createMenu({
        title: template.name,
        template_id: template.id,
      });

      // Vista previa inmediata en «Mis menús» (sin esperar al primer autosave del editor).
      try {
        let thumbnail = template.thumbnail_url ?? null;
        if (!thumbnail && template.canvas_data) {
          thumbnail = await renderCanvasDataThumbnail(template.canvas_data);
        }
        if (thumbnail) {
          await updateMenu(menu.id, { thumbnail_url: thumbnail });
        }
      } catch {
        /* El menú ya está creado; el preview puede generarse al guardar en el editor */
      }

      navigate(`/editor/${menu.id}`);
    } finally {
      setCreating(null);
    }
  }

  const blankTemplate =
    templates.find((t) => t.id === 'tpl-blank-1') ??
    templates.find((t) => (t.name ?? '').toLowerCase().includes('blanco'));
  const otherTemplates = templates.filter((t) => t.id !== blankTemplate?.id);
  const categories = [...new Set(otherTemplates.map((t) => t.category ?? 'general'))];

  function renderTemplateCard(template: TemplateSummary) {
    return (
      <article key={template.id} className="template-card">
        <div className="template-preview">
          {template.thumbnail_url ? (
            <img src={template.thumbnail_url} alt={template.name} />
          ) : template.canvas_data ? (
            <TemplatePreview canvasData={template.canvas_data} name={template.name} />
          ) : (
            <div className="template-preview-placeholder">{template.name}</div>
          )}
        </div>
        <h3>{template.name}</h3>
        {template.is_premium && <span className="badge">Premium</span>}
        <button
          type="button"
          className="btn-primary"
          disabled={creating === template.id}
          onClick={() => handleUseTemplate(template)}
        >
          {creating === template.id ? 'Creando...' : 'Usar plantilla'}
        </button>
      </article>
    );
  }

  return (
    <div className="templates-page">
      <AppLayout />
      <main className="templates-main">
        <h1>Galería de plantillas</h1>
        <p>Elige una plantilla como punto de partida para tu carta.</p>

        {loading && <p>Cargando plantillas...</p>}

        {!loading && blankTemplate && (
          <section className="template-category">
            <div className="template-grid">{renderTemplateCard(blankTemplate)}</div>
          </section>
        )}

        {categories.map((category) => (
          <section key={category} className="template-category">
            <h2>{category.charAt(0).toUpperCase() + category.slice(1)}</h2>
            <div className="template-grid">
              {otherTemplates
                .filter((t) => (t.category ?? 'general') === category)
                .map((template) => renderTemplateCard(template))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
