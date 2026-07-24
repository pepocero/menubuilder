import { useEffect, useRef, useState } from 'react';
import type { MenuPage } from '@/types/canvas';
import { getPageSize } from '@/lib/page-size';
import {
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
 * la imagen. Así tipografía, espacios y capas coinciden en cualquier móvil.
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

    const run = async () => {
      setError(false);
      const png = await renderMenuPageToDataUrl(page);
      if (cancelled) return;
      if (!png) {
        setError(true);
        setDataUrl(null);
        return;
      }
      setDataUrl(png);
    };

    void run();

    const onFontsDone = () => {
      if (!cancelled) void run();
    };
    document.fonts?.addEventListener?.('loadingdone', onFontsDone);
    window.addEventListener('orientationchange', onFontsDone);

    const late = window.setTimeout(() => {
      if (!cancelled) void run();
    }, 500);

    return () => {
      cancelled = true;
      document.fonts?.removeEventListener?.('loadingdone', onFontsDone);
      window.removeEventListener('orientationchange', onFontsDone);
      window.clearTimeout(late);
    };
  }, [page]);

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
