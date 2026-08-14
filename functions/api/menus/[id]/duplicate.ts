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

  const now = new Date().toISOString();

  return jsonResponse(
    {
      menu: {
        id: newId,
        title: newTitle,
        template_id: menu.template_id,
        editor_kind: menu.editor_kind ?? 'canvas',
        thumbnail_url: menu.thumbnail_url ?? null,
        is_public: false,
        public_slug: null,
        created_at: now,
        updated_at: now,
      },
    },
    201,
  );
};
