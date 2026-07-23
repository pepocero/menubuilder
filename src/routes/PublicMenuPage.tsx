import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { HtmlRenderer } from '@/components/html-renderer';
import { PublicPageView } from '@/components/public/PublicPageView';
import { ApiError } from '@/lib/api';
import { SITE_NAME, applyPageSeo } from '@/lib/seo';
import type { MenuPage } from '@/types/canvas';
import { normalizeCanvasData } from '@/types/canvas';
import {
  canvasDataToMenuDocument,
  parseMenuDocument,
  type MenuDocument,
} from '@shared/menu-document';

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
 * Prioridad de render público:
 * 1) menu_document → HTML
 * 2) generar MenuDocument desde canvas_data → HTML
 * 3) capas canvas (PublicPageView) → HTML posicionado
 * 4) PNG exportado (último recurso)
 */
export function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const [menuDocument, setMenuDocument] = useState<MenuDocument | null>(null);
  const [pages, setPages] = useState<MenuPage[]>([]);
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

        const storedDoc = parseMenuDocument(menu.menu_document);
        if (storedDoc) {
          setMenuDocument(storedDoc);
          setPages([]);
          setLoading(false);
          return;
        }

        const canvasDoc = normalizeCanvasData(menu.canvas_data);
        const generatedDoc = canvasDataToMenuDocument(canvasDoc, {
          title: safeTitle,
          sourceMenuId: menu.public_slug,
        });

        if (generatedDoc && generatedDoc.pages.length > 0) {
          setMenuDocument(generatedDoc);
          setPages([]);
          setLoading(false);
          return;
        }

        setMenuDocument(null);
        setPages(canvasDoc.pages);
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

  const showDocument = !!menuDocument;
  const showPages = !showDocument && pages.length > 0;
  const showPng = !showDocument && !showPages && !!exportPngUrl;

  return (
    <div className="public-menu-page">
      <main className="public-menu-main">
        {loading && <p className="public-menu-status">Cargando carta…</p>}
        {error && <div className="error-banner">{error}</div>}

        {!loading && !error && showDocument && (
          <HtmlRenderer document={menuDocument!} showTitle={false} />
        )}

        {!loading && !error && showPages && (
          <div className="public-pages-stack">
            {pages.map((page) => (
              <div key={page.id} className="public-page-block">
                <PublicPageView page={page} />
              </div>
            ))}
          </div>
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

        {!loading && !error && !showDocument && !showPages && !showPng && (
          <p className="public-menu-status">Esta carta no tiene contenido para mostrar.</p>
        )}
      </main>
    </div>
  );
}
