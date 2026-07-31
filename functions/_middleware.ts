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

  const response = await next();

  // Cloudflare Pages puede devolver index.html (SPA) para /assets/* faltantes.
  // Eso llega al navegador como module script con MIME text/html → pantalla en blanco.
  if (isAssetOrFontPath(url.pathname) && looksLikeHtml(response)) {
    return new Response('Not Found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  // Fallback SPA explícito por si el proyecto no reescribe solo.
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
