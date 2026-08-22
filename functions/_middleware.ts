import { isPublicApiPath, requireAuth } from './lib/middleware';

function isAssetOrFontPath(pathname: string): boolean {
  return pathname.startsWith('/assets/') || pathname.startsWith('/fonts/');
}

function isSpaNavigation(request: Request, pathname: string): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  if (pathname.startsWith('/api/')) return false;
  if (isAssetOrFontPath(pathname)) return false;
  const last = pathname.split('/').pop() ?? '';
  if (last.includes('.') && !last.endsWith('.html')) return false;
  return true;
}

function looksLikeHtml(response: Response): boolean {
  const ct = response.headers.get('content-type') || '';
  return ct.includes('text/html');
}

function contentTypeForAsset(pathname: string): string | null {
  if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) {
    return 'application/javascript; charset=utf-8';
  }
  if (pathname.endsWith('.css')) return 'text/css; charset=utf-8';
  if (pathname.endsWith('.wasm')) return 'application/wasm';
  if (pathname.endsWith('.map')) return 'application/json; charset=utf-8';
  if (pathname.endsWith('.woff2')) return 'font/woff2';
  if (pathname.endsWith('.woff')) return 'font/woff';
  if (pathname.endsWith('.ttf')) return 'font/ttf';
  if (pathname.endsWith('.svg')) return 'image/svg+xml';
  return null;
}

function notFoundAsset(): Response {
  return new Response('Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** Nunca devolver HTML por una ruta /assets|fonts (rompe MIME de módulos ES). */
async function serveStaticAsset(
  request: Request,
  env: Env,
  pathname: string,
): Promise<Response> {
  const assets = env.ASSETS;
  if (!assets) return notFoundAsset();

  const assetResponse = await assets.fetch(request);
  if (!assetResponse.ok || looksLikeHtml(assetResponse)) {
    return notFoundAsset();
  }

  const headers = new Headers(assetResponse.headers);
  const forcedType = contentTypeForAsset(pathname);
  if (forcedType) {
    headers.set('Content-Type', forcedType);
  }
  // Hashes de Vite: cache larga y segura. Un 404 nunca llega aquí.
  if (pathname.startsWith('/assets/')) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  headers.set('X-Content-Type-Options', 'nosniff');

  return new Response(assetResponse.body, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers,
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) {
    if (isPublicApiPath(url.pathname, request.method)) {
      return next();
    }

    const auth = await requireAuth(request, env);
    if ('response' in auth) {
      return auth.response;
    }

    context.data = {
      ...context.data,
      userId: auth.user.userId,
      email: auth.user.email,
      role: auth.user.role,
    };

    return next();
  }

  if (isAssetOrFontPath(url.pathname)) {
    return serveStaticAsset(request, env, url.pathname);
  }

  const response = await next();

  if (response.status === 404 && isSpaNavigation(request, url.pathname)) {
    const assets = env.ASSETS;
    if (assets) {
      const indexResponse = await assets.fetch(
        new Request(new URL('/index.html', url.origin), request),
      );
      if (indexResponse.ok) {
        const headers = new Headers(indexResponse.headers);
        headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        headers.set('Content-Type', 'text/html; charset=utf-8');
        return new Response(indexResponse.body, { status: 200, headers });
      }
    }
    return next(new Request(new URL('/index.html', url.origin), request));
  }

  return response;
};
