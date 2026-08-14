import { deleteUserTemplate, getTemplateById } from '../../lib/db';
import { getAuthUser } from '../../lib/middleware';
import { templateToJson } from '../../lib/template-api';
import { errorResponse, jsonResponse } from '../../lib/types';
import { isTemplateVisible } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const templateId = context.params.id as string;
  const template = await getTemplateById(context.env.DB, templateId);

  if (!template) {
    return errorResponse('Plantilla no encontrada', 404);
  }

  const viewer = await getAuthUser(context.request, context.env);
  if (!isTemplateVisible(template, viewer?.userId ?? null)) {
    return errorResponse('Plantilla no encontrada', 404);
  }

  return jsonResponse({
    template: templateToJson(template),
  });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const userId = context.data.userId as string;
  const templateId = context.params.id as string;
  const template = await getTemplateById(context.env.DB, templateId);

  if (!template || template.user_id !== userId) {
    return errorResponse('Plantilla no encontrada', 404);
  }

  const deleted = await deleteUserTemplate(context.env.DB, templateId, userId);
  if (!deleted) {
    return errorResponse('No se pudo eliminar la plantilla', 500);
  }

  return jsonResponse({ ok: true });
};
