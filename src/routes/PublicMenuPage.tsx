import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { HtmlRenderer } from '@/components/html-renderer';
import { PublicPageView } from '@/components/public/PublicPageView';
import { getPublicMenu } from '@/lib/api';
import { SITE_NAME, applyPageSeo } from '@/lib/seo';
import type { MenuPage } from '@/types/canvas';
import { A4_HEIGHT, A4_WIDTH, normalizeCanvasData } from '@/types/canvas';
import { parseMenuDocument, type MenuDocument } from '@shared/menu-document';

export function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const [menuDocument, setMenuDocument] = useState<MenuDocument | null>(null);
  const [pages, setPages] = useState<MenuPage[]>([]);
  const [pageWidth, setPageWidth] = useState(A4_WIDTH);
  const [pageHeight, setPageHeight] = useState(A4_HEIGHT);
  const [exportPngUrl, setExportPngUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let disposed = false;

    (async () => {
      try {
        const { menu } = await getPublicMenu(slug);
        if (disposed) return;

        applyPageSeo({
          title: menu.title?.trim() || 'Carta digital',
          description: menu.title?.trim()
            ? `${menu.title.trim()} — carta de menú digital publicada con ${SITE_NAME}.`
            : `Carta de menú digital publicada con ${SITE_NAME}.`,
          path: `/p/${slug}`,
          index: true,
        });

        const doc = parseMenuDocument(menu.menu_document);
        if (doc) {
          setMenuDocument(doc);
          setLoading(false);
          return;
        }

        setExportPngUrl(menu.export_png_url ?? menu.thumbnail_url ?? null);

        const canvasDoc = normalizeCanvasData(menu.canvas_data);
        setPageWidth(canvasDoc.width || A4_WIDTH);
        setPageHeight(canvasDoc.height || A4_HEIGHT);
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

  return (
    <div className="public-menu-page">
      <main className="public-menu-main">
        {loading && <p>Cargando carta...</p>}
        {error && <div className="error-banner">{error}</div>}

        {!loading && !error && menuDocument && (
          <HtmlRenderer document={menuDocument} showTitle={false} />
        )}

        {!loading && !error && !menuDocument && pages.length > 0 && (
          <div className="public-pages-stack">
            {pages.map((page) => (
              <div key={page.id} className="public-page-block">
                <PublicPageView
                  page={page}
                  pageWidth={pageWidth}
                  pageHeight={pageHeight}
                />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && !menuDocument && pages.length === 0 && exportPngUrl && (
          <figure className="public-png-fallback">
            <img
              src={exportPngUrl}
              alt="Carta de menú"
              className="public-page-image"
              draggable={false}
            />
          </figure>
        )}
      </main>
    </div>
  );
}
