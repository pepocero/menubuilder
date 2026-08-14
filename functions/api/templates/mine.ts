import { listMyTemplates } from '../../lib/db';
import { templateToJson } from '../../lib/template-api';
import { jsonResponse } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const userId = context.data.userId as string;
  const templates = await listMyTemplates(context.env.DB, userId);

  return jsonResponse({
    templates: templates.map((t) => templateToJson(t)),
  });
};
