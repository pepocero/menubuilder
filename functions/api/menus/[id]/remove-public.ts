import { getMenuById, removeMenuPublication } from '../../../lib/db';
import { deleteMenuExportPng } from '../../../lib/menu-export';
import { errorResponse, jsonResponse } from '../../../lib/types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const userId = context.data.userId as string;
  const email = context.data.email as string;
  const menuId = context.params.id as string;
  const menu = await getMenuById(context.env.DB, menuId);

  if (!menu || menu.user_id !== userId) {
    return errorResponse('Menú no encontrado', 404);
  }

  const removed = await removeMenuPublication(context.env.DB, menuId, userId);
  if (!removed) {
    return errorResponse('No se pudo eliminar la publicación', 500);
  }

  try {
    await deleteMenuExportPng(context.env.MEDIA, email, menuId, userId);
  } catch {
    /* best-effort */
  }

  return jsonResponse({ ok: true, is_public: false, public_slug: null });
};
