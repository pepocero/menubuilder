import { getMenuById, unpublishMenu } from '../../../lib/db';
import { errorResponse, jsonResponse } from '../../../lib/types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const userId = context.data.userId as string;
  const menuId = context.params.id as string;
  const menu = await getMenuById(context.env.DB, menuId);

  if (!menu || menu.user_id !== userId) {
    return errorResponse('Menú no encontrado', 404);
  }

  const unpublished = await unpublishMenu(context.env.DB, menuId, userId);
  if (!unpublished) {
    return errorResponse('No se pudo despublicar', 500);
  }

  return jsonResponse({ ok: true, is_public: false });
};
