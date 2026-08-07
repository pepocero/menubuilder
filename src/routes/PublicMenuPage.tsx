import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { HtmlRenderer } from '@/components/html-renderer';
import { MobilePublicView } from '@/components/mobile-public/MobilePublicView';
import { PublicPageView } from '@/components/public/PublicPageView';
import { ApiError } from '@/lib/api';
import { SITE_NAME, applyPageSeo } from '@/lib/seo';
import type { MenuPage, PageGap, PageScrollDirection } from '@/types/canvas';
import {
  normalizeCanvasData,
  normalizePageGap,
  validateCanvasData,
} from '@/types/canvas';
import { parseMenuDocument, type MenuDocument } from '@shared/menu-document';
import { parseMobileMenuDocument, type MobileMenuDocument } from '@shared/mobile-menu';

interface PublicMenuPayload {
  title: string;
  editor_kind: 'canvas' | 'mobile';
  canvas_data: unknown;
  mobile_document: unknown;
  menu_document: unknown;
  export_png_url: string | null;
  thumbnail_url: string | null;
  updated_at: string;
  public_slug: string;
}

/** Fetch público sin cookies/refresh de auth (más fiable en móviles / Brave). */
async function fetchPublicMenu(slug: string): Promise<PublicMenuPayload> {
  const response = await fetch(`/api/public/menus/${encodeURIComponent(slug)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const data = (await response.json().catch(() => ({}))) as {
    menu?: PublicMenuPayload;
    error?: string;
  };
  if (!response.ok || !data.menu) {
    throw new ApiError(data.error ?? 'Carta no disponible', response.status || 404);
  }
  return data.menu;
}

function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  return value.startsWith('/') || /^https?:\/\//i.test(value);
}

function coerceMobileDocument(raw: unknown): MobileMenuDocument | null {
  const direct = parseMobileMenuDocument(raw);
  if (direct) return direct;
  if (typeof raw === 'string') {
    try {
      return parseMobileMenuDocument(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  return null;
}

function hasRenderableContent(menu: PublicMenuPayload): boolean {
  if (menu.editor_kind === 'mobile') {
    return !!coerceMobileDocument(menu.mobile_document);
  }
  if (validateCanvasData(menu.canvas_data)) {
    const canvasDoc = normalizeCanvasData(menu.canvas_data);
    return canvasDoc.pages.some((page) => page.hidden !== true);
  }
  if (parseMenuDocument(menu.menu_document)) return true;
  return isHttpUrl(menu.export_png_url);
}

/**
 * Prioridad de render público (fidelidad con el editor):
 * 1) canvas_data → PublicPageView (Fabric → PNG, mismo motor que el editor)
 * 2) menu_document → HtmlRenderer
 * 3) PNG exportado (último recurso)
 */
export function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const [menuDocument, setMenuDocument] = useState<MenuDocument | null>(null);
  const [mobileDocument, setMobileDocument] = useState<MobileMenuDocument | null>(null);
  const [pages, setPages] = useState<MenuPage[]>([]);
  const [pageScroll, setPageScroll] = useState<PageScrollDirection>('vertical');
  const [pageGap, setPageGap] = useState<PageGap>(0);
  const [exportPngUrl, setExportPngUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let disposed = false;
    let retryTimer = 0;

    const applyMenu = (menu: PublicMenuPayload) => {
      const safeTitle = menu.title?.trim() || 'Carta digital';
      setTitle(safeTitle);
      applyPageSeo({
        title: safeTitle,
        description: `${safeTitle} — carta de menú digital publicada con ${SITE_NAME}.`,
        path: `/p/${slug}`,
        index: true,
      });

      setExportPngUrl(isHttpUrl(menu.export_png_url) ? menu.export_png_url : null);

      if (menu.editor_kind === 'mobile') {
        const mobileDoc = coerceMobileDocument(menu.mobile_document);
        if (mobileDoc) {
          setMobileDocument(mobileDoc);
          setMenuDocument(null);
          setPages([]);
          setPageScroll('vertical');
          setPageGap(0);
          return true;
        }
        setMobileDocument(null);
        setMenuDocument(null);
        setPages([]);
        return false;
      }

      if (validateCanvasData(menu.canvas_data)) {
        const canvasDoc = normalizeCanvasData(menu.canvas_data);
        setPages(canvasDoc.pages.filter((page) => page.hidden !== true));
        setPageScroll(canvasDoc.pageScroll ?? 'vertical');
        setPageGap(normalizePageGap(canvasDoc.pageGap));
        setMenuDocument(null);
        setMobileDocument(null);
        return true;
      }

      const storedDoc = parseMenuDocument(menu.menu_document);
      if (storedDoc) {
        setMenuDocument(storedDoc);
        setMobileDocument(null);
        setPages([]);
        setPageScroll('vertical');
        setPageGap(0);
        return true;
      }

      setMenuDocument(null);
      setMobileDocument(null);
      setPages([]);
      setPageScroll('vertical');
      setPageGap(0);
      return isHttpUrl(menu.export_png_url);
    };

    (async () => {
      try {
        let menu = await fetchPublicMenu(slug);
        if (disposed) return;

        // Tras publicar, a veces el primer GET llega antes de que el documento esté listo.
        if (!hasRenderableContent(menu)) {
          await new Promise((resolve) => {
            retryTimer = window.setTimeout(resolve, 450);
          });
          if (disposed) return;
          menu = await fetchPublicMenu(slug);
          if (disposed) return;
        }

        applyMenu(menu);
        if (!disposed) setLoading(false);
      } catch {
        if (!disposed) {
          setError('Esta carta no está disponible o ya no es pública.');
          setLoading(false);
        }
      }
    })();

    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [slug]);

  const showPages = pages.length > 0;
  const showMobile = !!mobileDocument;
  const showDocument = !showMobile && !showPages && !!menuDocument;
  const showPng = !showMobile && !showPages && !showDocument && !!exportPngUrl;

  return (
    <div
      className={
        pageScroll === 'horizontal'
          ? 'public-menu-page public-menu-page--horizontal'
          : 'public-menu-page'
      }
    >
      <main className="public-menu-main">
        {loading && <p className="public-menu-status">Cargando carta…</p>}
        {error && <div className="error-banner">{error}</div>}

        {!loading && !error && showPages && (
          <div
            className={
              pageScroll === 'horizontal'
                ? 'public-pages-stack public-pages-stack--horizontal'
                : 'public-pages-stack'
            }
            style={{ ['--public-page-gap' as string]: `${pageGap}px` }}
          >
            {pages.map((page) => (
              <div key={page.id} className="public-page-block">
                <PublicPageView
                  page={page}
                  fit={pageScroll === 'horizontal' ? 'contain' : 'width'}
                />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && showMobile && <MobilePublicView document={mobileDocument!} />}

        {!loading && !error && showDocument && (
          <HtmlRenderer document={menuDocument!} showTitle={false} />
        )}

        {!loading && !error && showPng && (
          <figure className="public-png-fallback">
            <img
              src={exportPngUrl!}
              alt={title || 'Carta de menú'}
              className="public-page-image"
              draggable={false}
              decoding="async"
            />
          </figure>
        )}

        {!loading && !error && !showPages && !showMobile && !showDocument && !showPng && (
          <p className="public-menu-status">Esta carta no tiene contenido para mostrar.</p>
        )}
      </main>
    </div>
  );
}
