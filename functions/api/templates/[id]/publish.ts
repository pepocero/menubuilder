import { getTemplateById, setTemplatePublic, updateUserTemplateContent } from '../../../lib/db';
import { sanitizeTemplateContentForSharing } from '../../../lib/template-sanitize';
import { templateToJson } from '../../../lib/template-api';
import { errorResponse, jsonResponse } from '../../../lib/types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const userId = context.data.userId as string;
  const email = context.data.email as string;
  const templateId = context.params.id as string;
  const template = await getTemplateById(context.env.DB, templateId);

  if (!template || template.user_id !== userId) {
    return errorResponse('Plantilla no encontrada', 404);
  }

  const sanitized = sanitizeTemplateContentForSharing(
    {
      canvasData: template.canvas_data,
      mobileDocument: template.mobile_document,
      thumbnailUrl: template.thumbnail_url,
    },
    email,
  );

  const contentUpdated = await updateUserTemplateContent(
    context.env.DB,
    templateId,
    userId,
    sanitized.canvasData,
    sanitized.mobileDocument,
    sanitized.thumbnailUrl,
  );
  if (!contentUpdated) {
    return errorResponse('No se pudo preparar la plantilla', 500);
  }

  const published = await setTemplatePublic(context.env.DB, templateId, userId, true);
  if (!published) {
    return errorResponse('No se pudo publicar la plantilla', 500);
  }

  const updated = await getTemplateById(context.env.DB, templateId);
  if (!updated) return errorResponse('Plantilla no encontrada', 404);

  return jsonResponse({ template: templateToJson(updated) });
};
