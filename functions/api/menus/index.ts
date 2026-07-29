import { createMenu, getTemplateById, listMenusByUser } from '../../lib/db';
import { errorResponse, jsonResponse, parseJson } from '../../lib/types';
import {
  createDefaultMobileMenuDocument,
  parseMobileMenuDocument,
  type MobileMenuDocument,
} from '../../../shared/mobile-menu';

const DEFAULT_CANVAS = JSON.stringify({
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

interface CreateMenuBody {
  title?: string;
  template_id?: string;
  canvas_data?: unknown;
  editor_kind?: 'canvas' | 'mobile';
  mobile_document?: unknown;
}

function validateCanvasData(data: unknown): string | null {
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

  // Legado 1 página
  if (d.background && typeof d.background === 'object' && Array.isArray(d.layers)) {
    return JSON.stringify(data);
  }

  return null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const userId = context.data.userId as string;
  const menus = await listMenusByUser(context.env.DB, userId);

  return jsonResponse({
    menus: menus.map((m) => ({
      id: m.id,
      title: m.title,
      template_id: m.template_id,
      thumbnail_url: m.thumbnail_url,
      editor_kind: (m.editor_kind ?? 'canvas') as 'canvas' | 'mobile',
      is_public: m.is_public === 1,
      public_slug: m.public_slug,
      created_at: m.created_at,
      updated_at: m.updated_at,
    })),
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const userId = context.data.userId as string;
  const body = await parseJson<CreateMenuBody>(request);

  const title = body?.title?.trim() || 'Menú sin título';
  const editorKind: 'canvas' | 'mobile' = body?.editor_kind === 'mobile' ? 'mobile' : 'canvas';
  let canvasData = DEFAULT_CANVAS;
  let mobileDocument: MobileMenuDocument | null = null;
  let templateId: string | null = null;

  let thumbnailUrl: string | null = null;

  if (editorKind === 'mobile') {
    if (body?.mobile_document !== undefined) {
      const parsed = parseMobileMenuDocument(body.mobile_document);
      if (!parsed) return errorResponse('mobile_document inválido');
      mobileDocument = parsed;
    } else {
      mobileDocument = createDefaultMobileMenuDocument();
    }
  } else if (body?.template_id) {
    const template = await getTemplateById(env.DB, body.template_id);
    if (!template) {
      return errorResponse('Plantilla no encontrada', 404);
    }
    canvasData = template.canvas_data;
    templateId = template.id;
    thumbnailUrl = template.thumbnail_url ?? null;
  } else if (body?.canvas_data) {
    const validated = validateCanvasData(body.canvas_data);
    if (!validated) {
      return errorResponse('canvas_data inválido');
    }
    canvasData = validated;
  }

  const menuId = crypto.randomUUID();
  await createMenu(
    env.DB,
    menuId,
    userId,
    title,
    canvasData,
    templateId,
    editorKind,
    mobileDocument ? JSON.stringify(mobileDocument) : null,
    thumbnailUrl,
  );

  return jsonResponse(
    {
      menu: {
        id: menuId,
        title,
        template_id: templateId,
        editor_kind: editorKind,
        thumbnail_url: thumbnailUrl,
        canvas_data: JSON.parse(canvasData),
        mobile_document: mobileDocument,
      },
    },
    201,
  );
};
