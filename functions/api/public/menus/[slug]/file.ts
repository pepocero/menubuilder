import { getPublicMenuBySlug } from '../../../../lib/db';
import { errorResponse } from '../../../../lib/types';
import { collectR2KeysFromMenuContent } from '../../../../../shared/public-menu-assets';

function resolveR2Key(request: Request): string | null {
  const fromQuery = new URL(request.url).searchParams.get('key')?.trim();
  if (!fromQuery) return null;
  try {
    return decodeURIComponent(fromQuery);
  } catch {
    return fromQuery;
  }
}

/**
 * GET /api/public/menus/:slug/file?key=users/...
 * Sirve imágenes R2 referenciadas en una carta publicada (sin auth).
 * Cache larga: los assets son inmutables por clave.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const slug = context.params.slug as string;
  const r2Key = resolveR2Key(context.request);

  if (!slug?.trim()) {
    return errorResponse('Slug requerido', 400);
  }
  if (!r2Key) {
    return errorResponse('Clave de archivo requerida', 400);
  }
  if (!r2Key.startsWith('users/')) {
    return errorResponse('Archivo no encontrado', 404);
  }

  const menu = await getPublicMenuBySlug(context.env.DB, slug.trim());
  if (!menu) {
    return errorResponse('Carta no encontrada o no publicada', 404);
  }

  let canvasData: unknown = null;
  let mobileDocument: unknown = null;
  let menuDocument: unknown = null;

  try {
    canvasData = JSON.parse(menu.canvas_data);
  } catch {
    canvasData = null;
  }
  if (menu.mobile_document) {
    try {
      mobileDocument = JSON.parse(menu.mobile_document);
    } catch {
      mobileDocument = null;
    }
  }
  if (menu.menu_document) {
    try {
      menuDocument = JSON.parse(menu.menu_document);
    } catch {
      menuDocument = null;
    }
  }

  const allowedKeys = collectR2KeysFromMenuContent({
    canvas_data: canvasData,
    mobile_document: mobileDocument,
    menu_document: menuDocument,
    thumbnail_url: menu.thumbnail_url,
    export_png_url: menu.export_png_url,
  });

  if (!allowedKeys.has(r2Key)) {
    return errorResponse('Acceso denegado', 403);
  }

  const object = await context.env.MEDIA.get(r2Key);
  if (!object) {
    return errorResponse('Archivo no encontrado', 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Content-Disposition', 'inline');
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(object.body, { headers });
};
