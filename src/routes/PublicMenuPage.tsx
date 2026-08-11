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
async function fetchPublicMenu(slug: string, signal?: AbortSignal): Promise<PublicMenuPayload> {
  const response = await fetch(`/api/public/menus/${encodeURIComponent(slug)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
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

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
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
  const [loadNonce, setLoadNonce] = useState(0);

  useEffect(() => {
    if (!slug) return;
    let disposed = false;
    const abort = new AbortController();

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
      setLoading(true);
      setError('');
      try {
        let menu: PublicMenuPayload | null = null;
        let lastError: unknown = null;

        // Varios intentos: al abrir desde cámara/QR la primera petición a veces falla o llega vacía.
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (disposed || abort.signal.aborted) return;
          const attemptAbort = new AbortController();
          const onParentAbort = () => attemptAbort.abort();
          abort.signal.addEventListener('abort', onParentAbort);
          const timeout = window.setTimeout(() => attemptAbort.abort(), 12000);
          try {
            menu = await fetchPublicMenu(slug, attemptAbort.signal);
            if (hasRenderableContent(menu)) break;
            menu = null;
          } catch (err) {
            lastError = err;
            menu = null;
            if (abort.signal.aborted) return;
          } finally {
            window.clearTimeout(timeout);
            abort.signal.removeEventListener('abort', onParentAbort);
          }
          await wait(350 + attempt * 250);
        }

        if (disposed || abort.signal.aborted) return;

        if (!menu) {
          // Último intento limpio.
          try {
            menu = await fetchPublicMenu(slug, abort.signal);
          } catch (err) {
            lastError = err;
          }
        }

        if (disposed || abort.signal.aborted) return;

        if (!menu) {
          throw lastError instanceof Error
            ? lastError
            : new ApiError('Carta no disponible', 404);
        }

        if (!hasRenderableContent(menu)) {
          await wait(450);
          if (disposed || abort.signal.aborted) return;
          menu = await fetchPublicMenu(slug, abort.signal);
          if (disposed || abort.signal.aborted) return;
        }

        const ok = applyMenu(menu);
        if (!ok && !hasRenderableContent(menu)) {
          setError('Esta carta no está disponible o ya no es pública.');
        }
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
      abort.abort();
    };
  }, [slug, loadNonce]);

  // Si el móvil restaura la pestaña desde bfcache / cámara, reintentar carga.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setLoadNonce((n) => n + 1);
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (loading || error) return;
      // Si tras volver no hay nada renderizable, forzar recarga de datos.
      const empty =
        pages.length === 0 && !mobileDocument && !menuDocument && !exportPngUrl;
      if (empty) setLoadNonce((n) => n + 1);
    };
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loading, error, pages.length, mobileDocument, menuDocument, exportPngUrl]);

  // Si la carta quedó vacía tras “cargar”, un reload único suele arreglar WebViews rotos.
  useEffect(() => {
    if (loading || error || !slug) return;
    const empty =
      pages.length === 0 && !mobileDocument && !menuDocument && !exportPngUrl;
    if (!empty) return;
    const key = `ptm-public-empty-reload:${slug}`;
    if (sessionStorage.getItem(key)) return;
    const timer = window.setTimeout(() => {
      sessionStorage.setItem(key, '1');
      window.location.reload();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [loading, error, slug, pages.length, mobileDocument, menuDocument, exportPngUrl]);

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
        {error && (
          <div className="error-banner">
            {error}
            <div className="public-menu-retry">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setError('');
                  setLoadNonce((n) => n + 1);
                }}
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

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
