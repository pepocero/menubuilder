import { getTemplateById, setTemplatePublic } from '../../../lib/db';
import { templateToJson } from '../../../lib/template-api';
import { errorResponse, jsonResponse } from '../../../lib/types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const userId = context.data.userId as string;
  const templateId = context.params.id as string;
  const template = await getTemplateById(context.env.DB, templateId);

  if (!template || template.user_id !== userId) {
    return errorResponse('Plantilla no encontrada', 404);
  }

  const unpublished = await setTemplatePublic(context.env.DB, templateId, userId, false);
  if (!unpublished) {
    return errorResponse('No se pudo despublicar la plantilla', 500);
  }

  const updated = await getTemplateById(context.env.DB, templateId);
  if (!updated) return errorResponse('Plantilla no encontrada', 404);

  return jsonResponse({ template: templateToJson(updated) });
};
