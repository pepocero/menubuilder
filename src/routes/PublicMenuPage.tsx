import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Canvas } from 'fabric';
import { getPublicMenu } from '@/lib/api';
import type { MenuPage } from '@/types/canvas';
import { A4_HEIGHT, A4_WIDTH, normalizeCanvasData } from '@/types/canvas';
import { loadPageOntoCanvas } from '@/lib/canvas-serializer';

function enablePublicCanvasTouchScroll(canvas: Canvas): void {
  canvas.allowTouchScrolling = true;
  const upper = canvas.upperCanvasEl;
  const lower = canvas.lowerCanvasEl;
  const container = canvas.getElement().parentElement;
  for (const el of [upper, lower, container]) {
    if (el) {
      el.style.touchAction = 'pan-y pinch-zoom';
      el.style.pointerEvents = 'none';
    }
  }
}

function replaceCanvasWithImage(fabricCanvas: Canvas, wrapper: HTMLElement): boolean {
  try {
    const dataUrl = fabricCanvas.toDataURL({
      format: 'png',
      multiplier: window.devicePixelRatio > 1 ? 2 : 1,
    });
    fabricCanvas.dispose();

    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = '';
    img.className = 'public-page-image';
    img.draggable = false;
    img.decoding = 'async';
    img.loading = 'lazy';

    wrapper.replaceChildren(img);
    return true;
  } catch {
    enablePublicCanvasTouchScroll(fabricCanvas);
    return false;
  }
}

export function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<MenuPage[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let disposed = false;
    const fabricCanvases: Canvas[] = [];

    (async () => {
      try {
        const { menu } = await getPublicMenu(slug);
        if (disposed) return;

        if (menu.title) {
          document.title = menu.title;
        }

        const doc = normalizeCanvasData(menu.canvas_data);
        setPages(doc.pages);
        setLoading(false);

        // Esperar al render de los canvas elements
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (disposed || !containerRef.current) return;

        const canvasEls = containerRef.current.querySelectorAll<HTMLCanvasElement>(
          'canvas[data-public-page]',
        );

        for (let i = 0; i < doc.pages.length; i++) {
          const el = canvasEls[i];
          const page = doc.pages[i];
          if (!el || !page) continue;

          const wrap = el.closest<HTMLElement>('.public-canvas');
          if (!wrap) continue;

          const fabricCanvas = new Canvas(el, {
            width: A4_WIDTH,
            height: A4_HEIGHT,
            selection: false,
            allowTouchScrolling: true,
          });
          fabricCanvas.selection = false;
          fabricCanvases.push(fabricCanvas);

          await loadPageOntoCanvas(fabricCanvas, page, A4_WIDTH, A4_HEIGHT);
          fabricCanvas.forEachObject((obj) => {
            obj.set({ selectable: false, evented: false });
          });
          fabricCanvas.requestRenderAll();

          if (replaceCanvasWithImage(fabricCanvas, wrap)) {
            fabricCanvases.pop();
          }
        }
      } catch {
        if (!disposed) {
          setError('Esta carta no está disponible o ya no es pública.');
          setLoading(false);
        }
      }
    })();

    return () => {
      disposed = true;
      for (const c of fabricCanvases) {
        c.dispose();
      }
    };
  }, [slug]);

  return (
    <div className="public-menu-page">
      <main className="public-menu-main" ref={containerRef}>
        {loading && <p>Cargando carta...</p>}
        {error && <div className="error-banner">{error}</div>}
        {!loading && !error && (
          <div className="public-pages-stack">
            {pages.map((page, index) => (
              <div key={page.id} className="public-page-block">
                <div className="editor-canvas-wrap public-canvas">
                  <canvas data-public-page={index} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
