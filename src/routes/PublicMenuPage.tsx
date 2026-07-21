import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PublicPageView } from '@/components/public/PublicPageView';
import { getPublicMenu } from '@/lib/api';
import type { MenuPage } from '@/types/canvas';
import { A4_HEIGHT, A4_WIDTH, normalizeCanvasData } from '@/types/canvas';

export function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const [pages, setPages] = useState<MenuPage[]>([]);
  const [pageWidth, setPageWidth] = useState(A4_WIDTH);
  const [pageHeight, setPageHeight] = useState(A4_HEIGHT);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let disposed = false;

    (async () => {
      try {
        const { menu } = await getPublicMenu(slug);
        if (disposed) return;

        if (menu.title) {
          document.title = menu.title;
        }

        const doc = normalizeCanvasData(menu.canvas_data);
        setPageWidth(doc.width || A4_WIDTH);
        setPageHeight(doc.height || A4_HEIGHT);
        setPages(doc.pages);
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
        {!loading && !error && (
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
      </main>
    </div>
  );
}
