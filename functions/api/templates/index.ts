import {
  createUserTemplate,
  getMenuById,
  getTemplateById,
  listTemplates,
  updateUserTemplateContent,
} from '../../lib/db';
import {
  DEFAULT_TEMPLATE_CANVAS,
  templateToJson,
  validateCanvasData,
} from '../../lib/template-api';
import {
  sanitizeTemplateContentForSharing,
} from '../../lib/template-sanitize';
import { errorResponse, jsonResponse, parseJson } from '../../lib/types';
import { parseMobileMenuDocument } from '../../../shared/mobile-menu';

interface CreateTemplateBody {
  name?: string;
  canvas_data?: unknown;
  mobile_document?: unknown;
  editor_kind?: 'canvas' | 'mobile';
  thumbnail_url?: string | null;
  menu_id?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const templates = await listTemplates(context.env.DB);

  return jsonResponse({
    templates: templates
      .map((t) => {
        try {
          return templateToJson(t);
        } catch {
          return null;
        }
      })
      .filter((t): t is Record<string, unknown> => t !== null),
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const userId = context.data.userId as string;
  const email = context.data.email as string;
  const body = await parseJson<CreateTemplateBody>(context.request);
  if (!body) return errorResponse('Cuerpo inválido');

  const name = body.name?.trim();
  if (!name || name.length > 120) {
    return errorResponse('Nombre de plantilla inválido');
  }

  let editorKind: 'canvas' | 'mobile' =
    body.editor_kind === 'mobile' ? 'mobile' : 'canvas';
  let canvasData: string | null = null;
  let mobileDocument: string | null = null;
  let thumbnailUrl: string | null =
    typeof body.thumbnail_url === 'string' && body.thumbnail_url.trim()
      ? body.thumbnail_url.trim()
      : null;

  if (body.menu_id) {
    const menu = await getMenuById(context.env.DB, body.menu_id);
    if (!menu || menu.user_id !== userId) {
      return errorResponse('Menú no encontrado', 404);
    }
    if (menu.editor_kind === 'mobile') {
      editorKind = 'mobile';
      canvasData = menu.canvas_data || DEFAULT_TEMPLATE_CANVAS;
      mobileDocument = menu.mobile_document;
    } else {
      editorKind = 'canvas';
      canvasData = menu.canvas_data;
    }
    if (!thumbnailUrl && menu.thumbnail_url) {
      thumbnailUrl = menu.thumbnail_url;
    }
  }

  if (body.canvas_data !== undefined) {
    const validated = validateCanvasData(body.canvas_data);
    if (!validated) return errorResponse('canvas_data inválido');
    canvasData = validated;
    editorKind = 'canvas';
    mobileDocument = null;
  }

  if (body.mobile_document !== undefined) {
    const parsed = parseMobileMenuDocument(body.mobile_document);
    if (!parsed) return errorResponse('mobile_document inválido');
    mobileDocument = JSON.stringify(parsed);
    editorKind = 'mobile';
    if (!canvasData) canvasData = DEFAULT_TEMPLATE_CANVAS;
  }

  if (editorKind === 'mobile') {
    if (!mobileDocument) {
      return errorResponse('Faltan datos del diseño móvil (mobile_document o menu_id)');
    }
    if (!canvasData) canvasData = DEFAULT_TEMPLATE_CANVAS;
  } else if (!canvasData) {
    return errorResponse('Faltan datos del diseño (canvas_data o menu_id)');
  }

  const sanitized = sanitizeTemplateContentForSharing(
    {
      canvasData,
      mobileDocument,
      thumbnailUrl,
    },
    email,
  );
  canvasData = sanitized.canvasData;
  mobileDocument = sanitized.mobileDocument;
  thumbnailUrl = sanitized.thumbnailUrl;

  const templateId = `utpl_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  await createUserTemplate(
    context.env.DB,
    templateId,
    userId,
    name,
    canvasData,
    thumbnailUrl,
    editorKind,
    mobileDocument,
  );

  const created = await getTemplateById(context.env.DB, templateId);
  if (!created) return errorResponse('No se pudo crear la plantilla', 500);

  return jsonResponse({ template: templateToJson(created) }, 201);
};
