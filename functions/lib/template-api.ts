import type { TemplateRow } from './types';

export const DEFAULT_TEMPLATE_CANVAS = JSON.stringify({
  width: 595,
  height: 842,
  pages: [
    {
      id: 'page_1',
      background: { type: 'color', value: '#FAF6F0' },
      layers: [],
    },
  ],
});

export function templateToJson(t: TemplateRow, includeContent = true): Record<string, unknown> {
  const base = {
    id: t.id,
    name: t.name,
    category: t.category,
    thumbnail_url: t.thumbnail_url,
    is_premium: t.is_premium === 1,
    user_id: t.user_id,
    is_public: t.is_public === 1,
    is_system: !t.user_id,
    author_name: t.author_name ?? null,
    editor_kind: t.editor_kind ?? 'canvas',
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
  if (!includeContent) return base;

  let canvasData: unknown = null;
  try {
    canvasData = JSON.parse(t.canvas_data);
  } catch {
    canvasData = JSON.parse(DEFAULT_TEMPLATE_CANVAS);
  }

  const result: Record<string, unknown> = {
    ...base,
    canvas_data: canvasData,
  };
  if (t.mobile_document) {
    try {
      result.mobile_document = JSON.parse(t.mobile_document);
    } catch {
      result.mobile_document = null;
    }
  }
  return result;
}

export function validateCanvasData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.width !== 'number' || typeof d.height !== 'number') return null;

  if (Array.isArray(d.pages) && d.pages.length > 0) {
    const ok = d.pages.every((p) => {
      if (!p || typeof p !== 'object') return false;
      const page = p as Record<string, unknown>;
      return (
        page.background !== null &&
        typeof page.background === 'object' &&
        Array.isArray(page.layers)
      );
    });
    return ok ? JSON.stringify(data) : null;
  }

  if (d.background && typeof d.background === 'object' && Array.isArray(d.layers)) {
    return JSON.stringify(data);
  }

  return null;
}
