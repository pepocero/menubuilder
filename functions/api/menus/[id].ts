import {
  countMenusReferencingAssetUrl,
  deleteAssetRow,
  deleteMenu,
  findAssetByR2Key,
  findAssetByUrl,
  getMenuById,
  updateMenu,
} from '../../lib/db';
import { deleteMenuExportPng, uploadMenuExportPng } from '../../lib/menu-export';
import { deleteFromR2, getAssetPublicUrl, parseR2KeyFromAssetUrl } from '../../lib/r2';
import { errorResponse, jsonResponse, parseJson } from '../../lib/types';
import {
  canvasDataToMenuDocument,
  serializeMenuDocument,
} from '../../../shared/menu-document/converter';
import { parseMobileMenuDocument } from '../../../shared/mobile-menu';

interface UpdateMenuBody {
  title?: string;
  canvas_data?: unknown;
  editor_kind?: 'canvas' | 'mobile';
  mobile_document?: unknown;
  thumbnail_url?: string | null;
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

  if (d.background && typeof d.background === 'object' && Array.isArray(d.layers)) {
    return JSON.stringify(data);
  }

  return null;
}

function extractAssetUrls(canvasDataJson: string): string[] {
  try {
    const data = JSON.parse(canvasDataJson) as {
      layers?: Array<{ type?: string; src?: string }>;
      pages?: Array<{ layers?: Array<{ type?: string; src?: string }> }>;
    };
    const urls = new Set<string>();
    const collect = (layers?: Array<{ type?: string; src?: string }>) => {
      for (const layer of layers ?? []) {
        if (layer.type === 'image' && layer.src?.includes('/api/assets/file/')) {
          urls.add(layer.src);
        }
      }
    };
    if (Array.isArray(data.pages)) {
      for (const page of data.pages) collect(page.layers);
    } else {
      collect(data.layers);
    }
    return [...urls];
  } catch {
    return [];
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const userId = context.data.userId as string;
  const menuId = context.params.id as string;
  const menu = await getMenuById(context.env.DB, menuId);

  if (!menu || menu.user_id !== userId) {
    return errorResponse('Menú no encontrado', 404);
  }

  return jsonResponse({
    menu: {
      id: menu.id,
      title: menu.title,
      template_id: menu.template_id,
      editor_kind: menu.editor_kind ?? 'canvas',
      canvas_data: JSON.parse(menu.canvas_data),
      mobile_document: menu.mobile_document ? JSON.parse(menu.mobile_document) : null,
      thumbnail_url: menu.thumbnail_url,
      is_public: menu.is_public === 1,
      public_slug: menu.public_slug,
      created_at: menu.created_at,
      updated_at: menu.updated_at,
    },
  });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const userId = context.data.userId as string;
  const menuId = context.params.id as string;
  const menu = await getMenuById(env.DB, menuId);

  if (!menu || menu.user_id !== userId) {
    return errorResponse('Menú no encontrado', 404);
  }

  const body = await parseJson<UpdateMenuBody>(request);
  if (!body) {
    return errorResponse('Cuerpo inválido');
  }

  const title = body.title?.trim() || menu.title;
  const editorKind: 'canvas' | 'mobile' =
    body.editor_kind === 'mobile' || (!body.editor_kind && menu.editor_kind === 'mobile')
      ? 'mobile'
      : 'canvas';
  let canvasData = menu.canvas_data;
  let mobileDocument = menu.mobile_document;

  if (body.canvas_data !== undefined) {
    const validated = validateCanvasData(body.canvas_data);
    if (!validated) {
      return errorResponse('canvas_data inválido');
    }
    canvasData = validated;
  }

  if (body.mobile_document !== undefined) {
    const parsed = parseMobileMenuDocument(body.mobile_document);
    if (!parsed) return errorResponse('mobile_document inválido');
    mobileDocument = JSON.stringify(parsed);
  }

  const thumbnailUrl =
    body.thumbnail_url !== undefined ? body.thumbnail_url : menu.thumbnail_url;

  const menuDocumentJson =
    editorKind === 'canvas'
      ? (() => {
          const parsedCanvas = JSON.parse(canvasData);
          const menuDoc = canvasDataToMenuDocument(parsedCanvas, {
            title,
            sourceMenuId: menuId,
          });
          return menuDoc ? serializeMenuDocument(menuDoc) : null;
        })()
      : null;

  let exportPngUrl = menu.export_png_url;
  if (
    typeof thumbnailUrl === 'string' &&
    thumbnailUrl.startsWith('data:image/png')
  ) {
    const uploaded = await uploadMenuExportPng(
      env.MEDIA,
      userId,
      menuId,
      thumbnailUrl,
      (key) => getAssetPublicUrl(request, key),
    );
    if (uploaded) {
      exportPngUrl = uploaded;
    }
  }

  const updated = await updateMenu(
    env.DB,
    menuId,
    userId,
    title,
    canvasData,
    editorKind,
    mobileDocument,
    thumbnailUrl,
    menuDocumentJson,
    exportPngUrl,
  );
  if (!updated) {
    return errorResponse('No se pudo actualizar', 500);
  }

  return jsonResponse({
    menu: {
      id: menuId,
      title,
      editor_kind: editorKind,
      canvas_data: JSON.parse(canvasData),
      mobile_document: mobileDocument ? JSON.parse(mobileDocument) : null,
      thumbnail_url: thumbnailUrl,
    },
  });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const userId = context.data.userId as string;
  const menuId = context.params.id as string;

  const menu = await getMenuById(env.DB, menuId);
  if (!menu || menu.user_id !== userId) {
    return errorResponse('Menú no encontrado', 404);
  }

  const assetUrls = extractAssetUrls(menu.canvas_data);

  // Borrar el menú primero: es la operación que el usuario espera.
  // La limpieza de R2/assets es secundaria y no debe hacer fallar la petición
  // (antes un fallo en R2 devolvía 500 aunque el menú ya estuviera eliminado).
  const deleted = await deleteMenu(env.DB, menuId, userId);
  if (!deleted) {
    return errorResponse('Menú no encontrado', 404);
  }

  try {
    for (const url of assetUrls) {
      try {
        const refs = await countMenusReferencingAssetUrl(env.DB, userId, url);
        if (refs > 0) continue;

        let asset = await findAssetByUrl(env.DB, userId, url);
        if (!asset) {
          const key = parseR2KeyFromAssetUrl(url);
          if (key) asset = await findAssetByR2Key(env.DB, userId, key);
        }
        if (!asset) continue;

        if (env.MEDIA) {
          await deleteFromR2(env.MEDIA, asset.r2_key);
        }
        await deleteAssetRow(env.DB, asset.id, userId);
      } catch (err) {
        console.error('No se pudo limpiar asset tras borrar menú', menuId, url, err);
      }
    }

    if (env.MEDIA) {
      await deleteMenuExportPng(env.MEDIA, userId, menuId);
    }
  } catch (err) {
    console.error('Limpieza post-borrado de menú falló (menú ya eliminado)', menuId, err);
  }

  return jsonResponse({ ok: true });
};
