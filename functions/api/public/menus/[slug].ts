import { normalizeAssetUrl, normalizeAssetUrlsInValue } from '../../../../shared/asset-url';
import { getPublicMenuBySlug } from '../../../lib/db';
import { errorResponse, jsonResponse } from '../../../lib/types';

/**
 * GET /api/public/menus/:slug
 * Público: sin autenticación. Devuelve la carta publicada con URLs de imagen
 * normalizadas al formato estable `/api/assets/file?key=…`.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const slug = context.params.slug as string;
  if (!slug) {
    return errorResponse('Slug requerido', 400);
  }

  const menu = await getPublicMenuBySlug(context.env.DB, slug);
  if (!menu) {
    return errorResponse('Carta no encontrada o no publicada', 404);
  }

  let canvasData: unknown = {};
  try {
    canvasData = JSON.parse(menu.canvas_data);
  } catch {
    canvasData = {};
  }

  let mobileDocument: unknown = null;
  if (menu.mobile_document) {
    try {
      mobileDocument = JSON.parse(menu.mobile_document);
    } catch {
      mobileDocument = null;
    }
  }

  let menuDocument: unknown = null;
  if (menu.menu_document) {
    try {
      menuDocument = JSON.parse(menu.menu_document);
    } catch {
      menuDocument = null;
    }
  }

  return jsonResponse(
    {
      menu: {
        title: menu.title,
        editor_kind: menu.editor_kind ?? 'canvas',
        canvas_data: normalizeAssetUrlsInValue(canvasData),
        mobile_document: mobileDocument
          ? normalizeAssetUrlsInValue(mobileDocument)
          : null,
        menu_document: menuDocument ? normalizeAssetUrlsInValue(menuDocument) : null,
        export_png_url: menu.export_png_url
          ? normalizeAssetUrl(menu.export_png_url)
          : null,
        thumbnail_url: menu.thumbnail_url
          ? normalizeAssetUrl(menu.thumbnail_url)
          : null,
        updated_at: menu.updated_at,
        public_slug: menu.public_slug,
      },
    },
    200,
    {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
      'Access-Control-Allow-Origin': '*',
    },
  );
};

export const onRequestHead: PagesFunction<Env> = async (context) => {
  const slug = context.params.slug as string;
  if (!slug) return errorResponse('Slug requerido', 400);
  const menu = await getPublicMenuBySlug(context.env.DB, slug);
  if (!menu) return errorResponse('Carta no encontrada o no publicada', 404);
  return new Response(null, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
