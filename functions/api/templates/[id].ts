import { getTemplateById } from '../../lib/db';
import { errorResponse, jsonResponse } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const templateId = context.params.id as string;
  const template = await getTemplateById(context.env.DB, templateId);

  if (!template) {
    return errorResponse('Plantilla no encontrada', 404);
  }

  return jsonResponse({
    template: {
      id: template.id,
      name: template.name,
      category: template.category,
      canvas_data: JSON.parse(template.canvas_data),
      thumbnail_url: template.thumbnail_url,
      is_premium: template.is_premium === 1,
    },
  });
};
