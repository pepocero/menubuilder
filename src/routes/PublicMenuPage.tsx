import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { HtmlRenderer } from '@/components/html-renderer';
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

interface PublicMenuPayload {
  title: string;
  canvas_data: unknown;
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

/**
 * Prioridad de render público (fidelidad con el editor):
 * 1) canvas_data → PublicPageView (Fabric → PNG, mismo motor que el editor)
 * 2) menu_document → HtmlRenderer
 * 3) PNG exportado (último recurso)
 */
export function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const [menuDocument, setMenuDocument] = useState<MenuDocument | null>(null);
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

    (async () => {
      try {
        const menu = await fetchPublicMenu(slug);
        if (disposed) return;

        const safeTitle = menu.title?.trim() || 'Carta digital';
        setTitle(safeTitle);
        applyPageSeo({
          title: safeTitle,
          description: `${safeTitle} — carta de menú digital publicada con ${SITE_NAME}.`,
          path: `/p/${slug}`,
          index: true,
        });

        setExportPngUrl(isHttpUrl(menu.export_png_url) ? menu.export_png_url : null);

        // Misma fuente de verdad que el editor.
        if (validateCanvasData(menu.canvas_data)) {
          const canvasDoc = normalizeCanvasData(menu.canvas_data);
          setPages(canvasDoc.pages);
          setPageScroll(canvasDoc.pageScroll ?? 'vertical');
          setPageGap(normalizePageGap(canvasDoc.pageGap));
          setMenuDocument(null);
          setLoading(false);
          return;
        }

        const storedDoc = parseMenuDocument(menu.menu_document);
        if (storedDoc) {
          setMenuDocument(storedDoc);
          setPages([]);
          setPageScroll('vertical');
          setPageGap(0);
          setLoading(false);
          return;
        }

        setMenuDocument(null);
        setPages([]);
        setPageScroll('vertical');
        setPageGap(0);
        setLoading(false);
      } catch {
        if (!disposed) {
          setError('Esta carta no está disponible o ya no es pública.');
          setLoading(false);
        }
      }
    })();

    return () => {
      disposed = true;
    };
  }, [slug]);

  const showPages = pages.length > 0;
  const showDocument = !showPages && !!menuDocument;
  const showPng = !showPages && !showDocument && !!exportPngUrl;

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

        {!loading && !error && !showPages && !showDocument && !showPng && (
          <p className="public-menu-status">Esta carta no tiene contenido para mostrar.</p>
        )}
      </main>
    </div>
  );
}
