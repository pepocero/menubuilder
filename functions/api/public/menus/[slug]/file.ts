import { canReadR2Asset } from '../../../../lib/asset-access';
import { errorResponse } from '../../../../lib/types';

function resolveR2Key(request: Request): string | null {
  const fromQuery = new URL(request.url).searchParams.get('key')?.trim();
  if (!fromQuery) return null;
  try {
    return decodeURIComponent(fromQuery);
  } catch {
    return fromQuery;
  }
}

/**
 * GET /api/public/menus/:slug/file?key=users/...
 * Alias de `/api/assets/file` (lectura pública). Se mantiene por URLs ya generadas.
 */
async function servePublicFile(
  context: EventContext<Env, string, Record<string, unknown>>,
): Promise<Response> {
  const slug = (context.params.slug as string)?.trim();
  const r2Key = resolveR2Key(context.request);

  if (!slug) return errorResponse('Slug requerido', 400);
  if (!r2Key) return errorResponse('Clave de archivo requerida', 400);
  if (!(await canReadR2Asset(context.env, context.request, r2Key))) {
    return errorResponse('Archivo no encontrado', 404);
  }

  const object = await context.env.MEDIA.get(r2Key);
  if (!object) return errorResponse('Archivo no encontrado', 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Content-Disposition', 'inline');
  headers.set('Access-Control-Allow-Origin', '*');
  if (object.size != null) headers.set('Content-Length', String(object.size));

  return new Response(object.body, { headers });
}

export const onRequestGet: PagesFunction<Env> = async (context) => servePublicFile(context);

export const onRequestHead: PagesFunction<Env> = async (context) => {
  const response = await servePublicFile(context);
  return new Response(null, { status: response.status, headers: response.headers });
};
