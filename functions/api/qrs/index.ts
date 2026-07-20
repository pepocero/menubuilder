import { listPublishedMenusByUser } from '../../lib/db';
import { jsonResponse } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const userId = context.data.userId as string;
  const menus = await listPublishedMenusByUser(context.env.DB, userId);

  return jsonResponse({
    menus: menus.map((m) => ({
      id: m.id,
      title: m.title,
      public_slug: m.public_slug,
      public_url: `/p/${m.public_slug}`,
      thumbnail_url: m.thumbnail_url,
      updated_at: m.updated_at,
    })),
  });
};
