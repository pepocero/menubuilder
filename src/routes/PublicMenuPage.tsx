import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MobilePublicView } from '@/components/mobile-public/MobilePublicView';
import { ApiError } from '@/lib/api';
import { clearPublicBootPlaceholder } from '@/lib/public-boot';
import { SITE_NAME, applyPageSeo } from '@/lib/seo';
import type { MenuPage, PageGap, PageScrollDirection } from '@/types/canvas';
import {
  normalizeCanvasData,
  normalizePageGap,
  validateCanvasData,
} from '@/types/canvas';
import { parseMenuDocument, type MenuDocument } from '@shared/menu-document';
import { parseMobileMenuDocument, type MobileMenuDocument } from '@shared/mobile-menu';
import { rewriteAssetUrlsForPublicSlug, toPublicMenuAssetUrl } from '@shared/public-menu-assets';

const PublicPageView = lazy(() =>
  import('@/components/public/PublicPageView').then((m) => ({ default: m.PublicPageView })),
);
const HtmlRenderer = lazy(() =>
  import('@/components/html-renderer').then((m) => ({ default: m.HtmlRenderer })),
);

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

const FETCH_TIMEOUT_MS = 15_000;
const MAX_FETCH_ATTEMPTS = 3;

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

async function fetchPublicMenuWithTimeout(
  slug: string,
  parentSignal?: AbortSignal,
): Promise<PublicMenuPayload> {
  const timeout = new AbortController();
  const onParentAbort = () => timeout.abort();
  parentSignal?.addEventListener('abort', onParentAbort);
  const timer = window.setTimeout(() => timeout.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetchPublicMenu(slug, timeout.signal);
  } finally {
    window.clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
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

function visibleCanvasPages(canvasData: unknown): MenuPage[] {
  if (!validateCanvasData(canvasData)) return [];
  return normalizeCanvasData(canvasData).pages.filter((page) => page.hidden !== true);
}

function hasRenderableContent(menu: PublicMenuPayload): boolean {
  if (menu.editor_kind === 'mobile' && coerceMobileDocument(menu.mobile_document)) {
    return true;
  }
  if (visibleCanvasPages(menu.canvas_data).length > 0) return true;
  if (parseMenuDocument(menu.menu_document)) return true;
  return isHttpUrl(menu.export_png_url);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

type AppliedMenuState = {
  mobileDocument: MobileMenuDocument | null;
  menuDocument: MenuDocument | null;
  pages: MenuPage[];
  pageScroll: PageScrollDirection;
  pageGap: PageGap;
  exportPngUrl: string | null;
  title: string;
};

function buildAppliedMenuState(menu: PublicMenuPayload, slug: string): AppliedMenuState | null {
  const safeTitle = menu.title?.trim() || 'Carta digital';
  const publicSlug = menu.public_slug || slug;
  const exportUrl = isHttpUrl(menu.export_png_url) ? menu.export_png_url : null;
  const exportPngUrl = exportUrl ? toPublicMenuAssetUrl(publicSlug, exportUrl) : null;

  if (menu.editor_kind === 'mobile') {
    const mobileDoc = coerceMobileDocument(menu.mobile_document);
    if (mobileDoc) {
      return {
        title: safeTitle,
        mobileDocument: rewriteAssetUrlsForPublicSlug(mobileDoc, publicSlug) as MobileMenuDocument,
        menuDocument: null,
        pages: [],
        pageScroll: 'vertical',
        pageGap: 0,
        exportPngUrl,
      };
    }
  }

  const canvasPages = visibleCanvasPages(
    rewriteAssetUrlsForPublicSlug(menu.canvas_data, publicSlug),
  );
  if (canvasPages.length > 0) {
    const canvasDoc = normalizeCanvasData(
      rewriteAssetUrlsForPublicSlug(menu.canvas_data, publicSlug),
    );
    return {
      title: safeTitle,
      mobileDocument: null,
      menuDocument: null,
      pages: canvasPages,
      pageScroll: canvasDoc.pageScroll ?? 'vertical',
      pageGap: normalizePageGap(canvasDoc.pageGap),
      exportPngUrl,
    };
  }

  const storedDoc = parseMenuDocument(menu.menu_document);
  if (storedDoc) {
    return {
      title: safeTitle,
      mobileDocument: null,
      menuDocument: rewriteAssetUrlsForPublicSlug(storedDoc, publicSlug) as MenuDocument,
      pages: [],
      pageScroll: 'vertical',
      pageGap: 0,
      exportPngUrl,
    };
  }

  if (exportPngUrl) {
    return {
      title: safeTitle,
      mobileDocument: null,
      menuDocument: null,
      pages: [],
      pageScroll: 'vertical',
      pageGap: 0,
      exportPngUrl,
    };
  }

  return null;
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
  const loadGenerationRef = useRef(0);

  useEffect(() => {
    clearPublicBootPlaceholder();
  }, []);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError('Enlace de carta no válido.');
      return;
    }

    const generation = ++loadGenerationRef.current;
    const abort = new AbortController();
    let finished = false;

    const finish = (next: { loading: boolean; error?: string }) => {
      if (finished || loadGenerationRef.current !== generation) return;
      finished = true;
      setLoading(next.loading);
      if (next.error !== undefined) setError(next.error);
    };

    const applyState = (state: AppliedMenuState) => {
      if (loadGenerationRef.current !== generation) return;
      setTitle(state.title);
      applyPageSeo({
        title: state.title,
        description: `${state.title} — carta de menú digital publicada con ${SITE_NAME}.`,
        path: `/p/${slug}`,
        index: true,
      });
      setMobileDocument(state.mobileDocument);
      setMenuDocument(state.menuDocument);
      setPages(state.pages);
      setPageScroll(state.pageScroll);
      setPageGap(state.pageGap);
      setExportPngUrl(state.exportPngUrl);
    };

    (async () => {
      setLoading(true);
      setError('');

      let menu: PublicMenuPayload | null = null;

      try {
        for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS; attempt += 1) {
          if (abort.signal.aborted || loadGenerationRef.current !== generation) return;

          try {
            menu = await fetchPublicMenuWithTimeout(slug, abort.signal);
            if (hasRenderableContent(menu)) break;
            menu = null;
          } catch {
            menu = null;
            if (abort.signal.aborted || loadGenerationRef.current !== generation) return;
          }

          if (attempt < MAX_FETCH_ATTEMPTS - 1) {
            await wait(300 + attempt * 200);
          }
        }

        if (abort.signal.aborted || loadGenerationRef.current !== generation) return;

        if (!menu) {
          menu = await fetchPublicMenuWithTimeout(slug, abort.signal);
        }

        if (abort.signal.aborted || loadGenerationRef.current !== generation) return;

        if (!hasRenderableContent(menu)) {
          await wait(400);
          if (abort.signal.aborted || loadGenerationRef.current !== generation) return;
          menu = await fetchPublicMenuWithTimeout(slug, abort.signal);
        }

        if (abort.signal.aborted || loadGenerationRef.current !== generation) return;

        const applied = buildAppliedMenuState(menu, slug);
        if (!applied) {
          finish({
            loading: false,
            error: 'Esta carta no está disponible o ya no es pública.',
          });
          return;
        }

        applyState(applied);
        finish({ loading: false, error: '' });
      } catch (err) {
        if (abort.signal.aborted || loadGenerationRef.current !== generation) return;
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof DOMException && err.name === 'AbortError'
              ? 'Tiempo de espera agotado al cargar la carta.'
              : 'Esta carta no está disponible o ya no es pública.';
        finish({ loading: false, error: message });
      }
    })();

    const watchdog = window.setTimeout(() => {
      if (loadGenerationRef.current !== generation || finished) return;
      finish({
        loading: false,
        error: 'La carta tarda demasiado en cargar. Comprueba tu conexión e inténtalo de nuevo.',
      });
    }, FETCH_TIMEOUT_MS * MAX_FETCH_ATTEMPTS + 8_000);

    return () => {
      abort.abort();
      window.clearTimeout(watchdog);
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
                <Suspense fallback={<p className="public-menu-status">Cargando página…</p>}>
                  <PublicPageView
                    page={page}
                    fit={pageScroll === 'horizontal' ? 'contain' : 'width'}
                  />
                </Suspense>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && showMobile && <MobilePublicView document={mobileDocument!} />}

        {!loading && !error && showDocument && (
          <Suspense fallback={<p className="public-menu-status">Cargando carta…</p>}>
            <HtmlRenderer document={menuDocument!} showTitle={false} />
          </Suspense>
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
