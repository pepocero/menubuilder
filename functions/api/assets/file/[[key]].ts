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

async function serveAsset(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response> {
  const r2Key = resolveR2Key(context.request, context.params as Record<string, string | string[]>);
  if (!r2Key) {
    return errorResponse('Clave de archivo requerida', 400);
  }

  if (!(await canReadR2Asset(context.env, context.request, r2Key))) {
    return errorResponse('Archivo no encontrado', 404);
  }

  const object = await context.env.MEDIA.get(r2Key);
  if (!object) {
    return errorResponse('Archivo no encontrado', 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Content-Disposition', 'inline');
  headers.set('Access-Control-Allow-Origin', '*');
  // Evita que proxies móviles corten descargas parciales de imágenes.
  if (object.size != null) {
    headers.set('Content-Length', String(object.size));
  }

  return new Response(object.body, { headers });
}

export const onRequestGet: PagesFunction<Env> = async (context) => serveAsset(context);

export const onRequestHead: PagesFunction<Env> = async (context) => {
  const response = await serveAsset(context);
  return new Response(null, { status: response.status, headers: response.headers });
};
