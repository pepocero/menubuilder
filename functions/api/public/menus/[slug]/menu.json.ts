import { getPublicMenuBySlug } from '../../../../lib/db';
import { errorResponse } from '../../../../lib/types';
import { parseMenuDocument } from '../../../../../shared/menu-document/converter';

/** GET /api/public/menus/:slug/menu.json — documento exportable del menú público */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const slug = context.params.slug as string;
  if (!slug) {
    return errorResponse('Slug requerido', 400);
  }

  const menu = await getPublicMenuBySlug(context.env.DB, slug);
  if (!menu) {
    return errorResponse('Carta no encontrada o no publicada', 404);
  }

  if (!menu.menu_document) {
    return errorResponse('Este menú no tiene documento JSON exportado', 404);
  }

  let document: unknown;
  try {
    document = JSON.parse(menu.menu_document);
  } catch {
    return errorResponse('Documento JSON inválido', 500);
  }

  if (!parseMenuDocument(document)) {
    return errorResponse('Documento JSON inválido', 500);
  }

  return new Response(JSON.stringify(document), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  });
};
