import { generateSlug, getMenuById, publishMenu } from '../../../lib/db';
import { errorResponse, jsonResponse } from '../../../lib/types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const userId = context.data.userId as string;
  const menuId = context.params.id as string;
  const menu = await getMenuById(context.env.DB, menuId);

  if (!menu || menu.user_id !== userId) {
    return errorResponse('Menú no encontrado', 404);
  }

  const slug = menu.public_slug ?? generateSlug();
  const published = await publishMenu(context.env.DB, menuId, userId, slug);

  if (!published) {
    return errorResponse('No se pudo publicar', 500);
  }

  return jsonResponse({
    public_slug: slug,
    public_url: `/p/${slug}`,
  });
};
