import { getPublicMenuBySlug } from '../../../lib/db';
import { errorResponse, jsonResponse } from '../../../lib/types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const slug = context.params.slug as string;
  if (!slug) {
    return errorResponse('Slug requerido', 400);
  }

  const menu = await getPublicMenuBySlug(context.env.DB, slug);
  if (!menu) {
    return errorResponse('Carta no encontrada o no publicada', 404);
  }

  return jsonResponse({
    menu: {
      title: menu.title,
      canvas_data: JSON.parse(menu.canvas_data),
      updated_at: menu.updated_at,
      public_slug: menu.public_slug,
    },
  });
};
