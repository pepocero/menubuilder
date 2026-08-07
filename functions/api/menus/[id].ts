import { deleteMenu, getMenuById, updateMenu } from '../../lib/db';
import {
  collectAssetUrlsFromMenuRow,
  garbageCollectRemovedAssetUrls,
} from '../../lib/asset-refs';
import { deleteMenuExportPng, uploadMenuExportPng } from '../../lib/menu-export';
import { getAssetPublicUrl } from '../../lib/r2';
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
  const email = context.data.email as string;
  const menuId = context.params.id as string;

  try {
    const menu = await getMenuById(env.DB, menuId);

    if (!menu || menu.user_id !== userId) {
      return errorResponse('Menú no encontrado', 404);
    }

    const body = await parseJson<UpdateMenuBody>(request);
    if (!body) {
      return errorResponse('Cuerpo inválido');
    }

    const urlsBefore = collectAssetUrlsFromMenuRow(menu);

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
      thumbnailUrl.startsWith('data:image/png') &&
      env.MEDIA
    ) {
      try {
        const uploaded = await uploadMenuExportPng(
          env.MEDIA,
          email,
          menuId,
          thumbnailUrl,
          (key) => getAssetPublicUrl(request, key),
          userId,
        );
        if (uploaded) {
          exportPngUrl = uploaded;
        }
      } catch (err) {
        console.error('uploadMenuExportPng falló (se continúa el guardado)', menuId, err);
      }
    }

    // No guardar data-URL enorme en thumbnail_url de D1 (rompe el UPDATE → 500).
    const thumbnailForDb =
      typeof thumbnailUrl === 'string' && thumbnailUrl.startsWith('data:')
        ? (exportPngUrl ?? menu.thumbnail_url ?? null)
        : thumbnailUrl;

    const updated = await updateMenu(
      env.DB,
      menuId,
      userId,
      title,
      canvasData,
      editorKind,
      mobileDocument,
      thumbnailForDb,
      menuDocumentJson,
      exportPngUrl,
    );
    if (!updated) {
      return errorResponse('No se pudo actualizar', 500);
    }

    const urlsAfter = collectAssetUrlsFromMenuRow({
      canvas_data: canvasData,
      mobile_document: mobileDocument,
      menu_document: menuDocumentJson,
      thumbnail_url: thumbnailForDb,
      export_png_url: exportPngUrl,
    });
    const removed: string[] = [];
    for (const url of urlsBefore) {
      if (!urlsAfter.has(url)) removed.push(url);
    }

    void garbageCollectRemovedAssetUrls(env, userId, removed).catch((err) => {
      console.error('GC assets tras update menú falló', menuId, err);
    });

    let parsedCanvas: unknown = null;
    let parsedMobile: unknown = null;
    try {
      parsedCanvas = JSON.parse(canvasData);
    } catch {
      parsedCanvas = null;
    }
    try {
      parsedMobile = mobileDocument ? JSON.parse(mobileDocument) : null;
    } catch {
      parsedMobile = null;
    }

    return jsonResponse({
      menu: {
        id: menuId,
        title,
        editor_kind: editorKind,
        canvas_data: parsedCanvas,
        mobile_document: parsedMobile,
        thumbnail_url: thumbnailForDb,
      },
    });
  } catch (err) {
    console.error('PUT /api/menus falló', menuId, err);
    const message = err instanceof Error ? err.message : 'No se pudo actualizar';
    return errorResponse(message, 500);
  }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const userId = context.data.userId as string;
  const email = context.data.email as string;
  const menuId = context.params.id as string;

  const menu = await getMenuById(env.DB, menuId);
  if (!menu || menu.user_id !== userId) {
    return errorResponse('Menú no encontrado', 404);
  }

  const assetUrls = collectAssetUrlsFromMenuRow(menu);

  // Borrar el menú primero: es la operación que el usuario espera.
  // La limpieza de R2/assets es secundaria y no debe hacer fallar la petición
  // (antes un fallo en R2 devolvía 500 aunque el menú ya estuviera eliminado).
  const deleted = await deleteMenu(env.DB, menuId, userId);
  if (!deleted) {
    return errorResponse('Menú no encontrado', 404);
  }

  try {
    await garbageCollectRemovedAssetUrls(env, userId, assetUrls);

    if (env.MEDIA) {
      await deleteMenuExportPng(env.MEDIA, email, menuId, userId);
    }
  } catch (err) {
    console.error('Limpieza post-borrado de menú falló (menú ya eliminado)', menuId, err);
  }

  return jsonResponse({ ok: true });
};
