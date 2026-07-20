import { errorResponse } from '../../../lib/types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const r2Key = decodeURIComponent(context.params.key as string);
  const object = await context.env.MEDIA.get(r2Key);

  if (!object) {
    return errorResponse('Archivo no encontrado', 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000');

  return new Response(object.body, { headers });
};
