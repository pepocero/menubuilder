import { listTemplates } from '../../lib/db';
import { jsonResponse } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const templates = await listTemplates(context.env.DB);

  return jsonResponse({
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      thumbnail_url: t.thumbnail_url,
      is_premium: t.is_premium === 1,
      canvas_data: JSON.parse(t.canvas_data),
    })),
  });
};
