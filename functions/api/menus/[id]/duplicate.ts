import { createMenu, getMenuById } from '../../../lib/db';
import { errorResponse, jsonResponse } from '../../../lib/types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const userId = context.data.userId as string;
  const menuId = context.params.id as string;
  const menu = await getMenuById(context.env.DB, menuId);

  if (!menu || menu.user_id !== userId) {
    return errorResponse('Menú no encontrado', 404);
  }

  const newId = crypto.randomUUID();
  const newTitle = `${menu.title} (copia)`;

  await createMenu(
    context.env.DB,
    newId,
    userId,
    newTitle,
    menu.canvas_data,
    menu.template_id,
    menu.editor_kind ?? 'canvas',
    menu.mobile_document ?? null,
    menu.thumbnail_url ?? null,
  );

  return jsonResponse(
    {
      menu: {
        id: newId,
        title: newTitle,
        editor_kind: menu.editor_kind ?? 'canvas',
        canvas_data: JSON.parse(menu.canvas_data),
        mobile_document: menu.mobile_document ? JSON.parse(menu.mobile_document) : null,
      },
    },
    201,
  );
};
