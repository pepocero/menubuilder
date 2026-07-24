import { useEffect, useRef, useState } from 'react';
import type { MenuPage } from '@/types/canvas';
import { getPageSize } from '@/lib/page-size';
import {
  computePublicRenderMultiplier,
  pageLetterboxColor,
  renderMenuPageToDataUrl,
} from '@/lib/render-menu-page';

interface PublicPageViewProps {
  page: MenuPage;
  /**
   * `width`: la página ocupa todo el ancho; el alto crece (scroll vertical).
   * `contain`: la página entera cabe en el viewport (scroll horizontal entre páginas).
   */
  fit?: 'width' | 'contain';
}

/**
 * Carta pública: renderiza con Fabric (igual que el editor) a PNG y escala
 * la imagen. El multiplier se calcula según el ancho visible y el DPR para
 * que en monitores grandes no se vea borroso.
 */
export function PublicPageView({ page, fit = 'width' }: PublicPageViewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const size = getPageSize(page);
  const bgColor = pageLetterboxColor(page);
  const containFit = fit === 'contain';

  useEffect(() => {
    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let lastMultiplier: number | null = null;

    const measureDisplayWidthCss = (): number => {
      const el = frameRef.current;
      if (!el) {
        return typeof window !== 'undefined' ? window.innerWidth : 0;
      }

      if (containFit) {
        const vw = el.clientWidth;
        const vh = el.clientHeight;
        if (vw <= 0 || vh <= 0) {
          return window.innerWidth;
        }
        const scale = Math.min(vw / size.width, vh / size.height);
        return size.width * scale;
      }

      return el.clientWidth > 0 ? el.clientWidth : window.innerWidth;
    };

    const run = async (force: boolean) => {
      const displayWidthCss = measureDisplayWidthCss();
      const multiplier = computePublicRenderMultiplier(size.width, displayWidthCss);

      if (!force && lastMultiplier === multiplier) {
        return;
      }

      setError(false);
      const png = await renderMenuPageToDataUrl(page, { multiplier });
      if (cancelled) return;
      if (!png) {
        setError(true);
        setDataUrl(null);
        return;
      }
      lastMultiplier = multiplier;
      setDataUrl(png);
    };

    const schedule = (force: boolean) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void run(force);
      }, force ? 0 : 160);
    };

    void run(true);

    const onFontsDone = () => {
      if (!cancelled) schedule(true);
    };
    document.fonts?.addEventListener?.('loadingdone', onFontsDone);
    window.addEventListener('orientationchange', onFontsDone);

    const late = window.setTimeout(() => {
      if (!cancelled) void run(true);
    }, 500);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (!cancelled) schedule(false);
          })
        : null;
    if (frameRef.current && resizeObserver) {
      resizeObserver.observe(frameRef.current);
    }

    const onWindowResize = () => {
      if (!cancelled) schedule(false);
    };
    window.addEventListener('resize', onWindowResize);

    return () => {
      cancelled = true;
      document.fonts?.removeEventListener?.('loadingdone', onFontsDone);
      window.removeEventListener('orientationchange', onFontsDone);
      window.removeEventListener('resize', onWindowResize);
      window.clearTimeout(late);
      if (debounceTimer) clearTimeout(debounceTimer);
      resizeObserver?.disconnect();
    };
  }, [page, containFit, size.width, size.height]);

  if (containFit) {
    return (
      <div
        ref={frameRef}
        className="public-page-viewport public-page-viewport--contain"
        style={{ background: bgColor }}
      >
        {!dataUrl && !error && (
          <p className="public-menu-status public-page-loading">Cargando página…</p>
        )}
        {error && (
          <p className="public-menu-status">No se pudo mostrar esta página.</p>
        )}
        {dataUrl && (
          <img
            className="public-page-fabric-image public-page-fabric-image--contain"
            src={dataUrl}
            alt=""
            draggable={false}
            decoding="async"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        )}
      </div>
    );
  }

  // Vertical: ancho completo, alto proporcional — se ve toda la página al hacer scroll.
  return (
    <div
      ref={frameRef}
      className="public-page-viewport-vertical"
      style={{
        width: '100%',
        background: bgColor,
      }}
    >
      {!dataUrl && !error && (
        <p className="public-menu-status public-page-loading">Cargando página…</p>
      )}
      {error && (
        <p className="public-menu-status">No se pudo mostrar esta página.</p>
      )}
      {dataUrl && (
        <img
          className="public-page-fabric-image public-page-fabric-image--width"
          src={dataUrl}
          alt=""
          draggable={false}
          decoding="async"
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            aspectRatio: `${size.width} / ${size.height}`,
          }}
        />
      )}
    </div>
  );
}
