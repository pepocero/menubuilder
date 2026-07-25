import { getMenuById, unpublishMenu } from '../../../lib/db';
import { errorResponse, jsonResponse } from '../../../lib/types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const userId = context.data.userId as string;
  const menuId = context.params.id as string;
  const menu = await getMenuById(context.env.DB, menuId);

  if (!menu || menu.user_id !== userId) {
    return errorResponse('Menú no encontrado', 404);
  }

  if (!menu.public_slug) {
    return errorResponse('Esta carta no tiene enlace público', 400);
  }

  const unpublished = await unpublishMenu(context.env.DB, menuId, userId);
  if (!unpublished) {
    return errorResponse('No se pudo despublicar', 500);
  }

  // Conserva public_slug y export_png_url: el QR impreso sigue siendo válido al republicar.
  return jsonResponse({
    ok: true,
    is_public: false,
    public_slug: menu.public_slug,
  });
};
