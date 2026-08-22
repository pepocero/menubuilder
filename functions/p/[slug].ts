import { getPublicMenuBySlug } from '../lib/db';
import {
  isMobileUserAgent,
  renderExportPngFallbackHtml,
  renderMobilePublicMenuHtml,
} from '../lib/public-menu-html';
import { parseMobileMenuDocument } from '../../shared/mobile-menu';

/**
 * GET /p/:slug
 * En móvil sirve HTML ligero generado en el edge (sin bundle React de ~1 MB).
 * Evita ERR_CONNECTION_ABORTED en redes móviles / Brave al escanear QR.
 * ?spa=1 fuerza la SPA completa (escritorio o versión animada).
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  return servePublicMenuPage(context);
};

export const onRequestHead: PagesFunction<Env> = async (context) => {
  const response = await servePublicMenuPage(context);
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
};

async function servePublicMenuPage(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response> {
  const slug = (context.params.slug as string)?.trim();
  if (!slug) {
    return new Response('Slug requerido', { status: 400 });
  }

  const url = new URL(context.request.url);
  const forceSpa = url.searchParams.get('spa') === '1';
  const ua = context.request.headers.get('User-Agent');
  const useLite = isMobileUserAgent(ua) && !forceSpa;

  if (!useLite) {
    const assets = context.env.ASSETS;
    if (assets) {
      const indexResponse = await assets.fetch(
        new Request(new URL('/index.html', url.origin), context.request),
      );
      if (indexResponse.ok) {
        const headers = new Headers(indexResponse.headers);
        headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        headers.set('Content-Type', 'text/html; charset=utf-8');
        return new Response(indexResponse.body, { status: 200, headers });
      }
    }
    return context.next();
  }

  const menu = await getPublicMenuBySlug(context.env.DB, slug);
  if (!menu) {
    return new Response(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Carta no disponible</title></head><body style="font-family:system-ui,sans-serif;padding:2rem;text-align:center"><h1>Carta no disponible</h1><p>Esta carta no existe o ya no está publicada.</p></body></html>`,
      {
        status: 404,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  const title = menu.title?.trim() || 'Carta digital';

  if (menu.mobile_document) {
    let raw: unknown;
    try {
      raw = JSON.parse(menu.mobile_document);
    } catch {
      raw = null;
    }
    const mobileDoc = parseMobileMenuDocument(raw);
    if (mobileDoc) {
      const html = renderMobilePublicMenuHtml({ slug, title, document: mobileDoc });
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
          'X-Public-Menu-Mode': 'lite-mobile',
        },
      });
    }
  }

  if (menu.export_png_url) {
    const html = renderExportPngFallbackHtml({
      slug,
      title,
      pngUrl: menu.export_png_url,
    });
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        'X-Public-Menu-Mode': 'lite-png',
      },
    });
  }

  const assets = context.env.ASSETS;
  if (assets) {
    const indexResponse = await assets.fetch(
      new Request(new URL('/index.html', url.origin), context.request),
    );
    if (indexResponse.ok) {
      return new Response(indexResponse.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }
  }

  return new Response('Carta no disponible', { status: 404 });
};
