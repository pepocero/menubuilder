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

interface UpdateMenuBody {
  title?: string;
  canvas_data?: unknown;
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
      canvas_data: JSON.parse(menu.canvas_data),
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
  let canvasData = menu.canvas_data;

  if (body.canvas_data !== undefined) {
    const validated = validateCanvasData(body.canvas_data);
    if (!validated) {
      return errorResponse('canvas_data inválido');
    }
    canvasData = validated;
  }

  const thumbnailUrl =
    body.thumbnail_url !== undefined ? body.thumbnail_url : menu.thumbnail_url;

  const parsedCanvas = JSON.parse(canvasData);
  const menuDoc = canvasDataToMenuDocument(parsedCanvas, {
    title,
    sourceMenuId: menuId,
  });
  const menuDocumentJson = menuDoc ? serializeMenuDocument(menuDoc) : null;

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
      canvas_data: JSON.parse(canvasData),
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

  const deleted = await deleteMenu(env.DB, menuId, userId);
  if (!deleted) {
    return errorResponse('Menú no encontrado', 404);
  }

  for (const url of assetUrls) {
    const refs = await countMenusReferencingAssetUrl(env.DB, userId, url);
    if (refs > 0) continue;

    let asset = await findAssetByUrl(env.DB, userId, url);
    if (!asset) {
      const key = parseR2KeyFromAssetUrl(url);
      if (key) asset = await findAssetByR2Key(env.DB, userId, key);
    }
    if (!asset) continue;

    await deleteFromR2(env.MEDIA, asset.r2_key);
    await deleteAssetRow(env.DB, asset.id, userId);
  }

  await deleteMenuExportPng(env.MEDIA, userId, menuId);

  return jsonResponse({ ok: true });
};
