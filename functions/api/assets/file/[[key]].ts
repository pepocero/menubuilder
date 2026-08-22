import { canReadR2Asset } from '../../../lib/asset-access';
import { errorResponse } from '../../../lib/types';

/**
 * Resuelve la r2_key desde:
 * - ?key=users/.../file  (preferido; no depende de %2F en el path)
 * - /api/assets/file/<segments...>  (catch-all; browsers que decodifican %2F)
 * - /api/assets/file/<encodeURIComponent(key)>  (URLs antiguas de un solo segmento)
 */
function resolveR2Key(
  request: Request,
  params: Record<string, string | string[]>,
): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get('key')?.trim();
  if (fromQuery) {
    try {
      return decodeURIComponent(fromQuery);
    } catch {
      return fromQuery;
    }
  }

  const raw = params.key;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    }).join('/');
  }

  if (typeof raw === 'string' && raw.length > 0) {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  return null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const r2Key = resolveR2Key(context.request, context.params as Record<string, string | string[]>);
  if (!r2Key) {
    return errorResponse('Clave de archivo requerida', 400);
  }

  if (!r2Key.startsWith('users/')) {
    return errorResponse('Archivo no encontrado', 404);
  }

  let allowed = false;
  try {
    allowed = await canReadR2Asset(context.env, context.request, r2Key);
  } catch (err) {
    console.error('canReadR2Asset', r2Key, err);
    return errorResponse('Error al comprobar acceso', 500);
  }
  if (!allowed) {
    return errorResponse('Acceso denegado', 403);
  }

  const object = await context.env.MEDIA.get(r2Key);
  if (!object) {
    return errorResponse('Archivo no encontrado', 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000');
  headers.set('Content-Disposition', 'inline');

  return new Response(object.body, { headers });
};
