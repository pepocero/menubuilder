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

function notFoundAsset(): Response {
  return new Response('Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
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

  // Servir assets/fonts vía ASSETS (no next()): evita SPA HTML con MIME text/html
  // y el fallo de next() con bundles JS grandes.
  if (isAssetOrFontPath(url.pathname)) {
    const assets = env.ASSETS;
    if (!assets) return notFoundAsset();
    const assetResponse = await assets.fetch(request);
    if (!assetResponse.ok || looksLikeHtml(assetResponse)) {
      return notFoundAsset();
    }
    return assetResponse;
  }

  const response = await next();

  // Fallback SPA para rutas de la app (/p/..., /mis-cartas, etc.).
  if (response.status === 404 && isSpaNavigation(request, url.pathname)) {
    const assets = env.ASSETS;
    if (assets) {
      const indexResponse = await assets.fetch(new Request(new URL('/index.html', url.origin), request));
      if (indexResponse.ok) {
        const headers = new Headers(indexResponse.headers);
        headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        return new Response(indexResponse.body, { status: 200, headers });
      }
    }
    return next(new Request(new URL('/index.html', url.origin), request));
  }

  return response;
};
