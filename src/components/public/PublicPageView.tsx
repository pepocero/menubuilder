import { useEffect, useRef, useState } from 'react';
import type { CanvasLayer, MenuPage, TextLayer } from '@/types/canvas';
import { normalizeAssetUrl } from '@/lib/asset-url';
import { ensureEditorFontLoaded } from '@/lib/google-fonts';
import { getPageSize } from '@/lib/page-size';
import { textBorderToCss } from '@/lib/text-border';
import { paintPublicTextLayer } from '@/lib/public-text-canvas';

interface PublicPageViewProps {
  page: MenuPage;
  pageWidth?: number;
  pageHeight?: number;
  /**
   * `width`: escala al ancho (vista pública vertical).
   * `contain`: encaja la página entera en el viewport (scroll horizontal entre páginas).
   */
  fit?: 'width' | 'contain';
}

function layerStyle(layer: CanvasLayer, scale: number): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    left: layer.x * scale,
    top: layer.y * scale,
    width: Math.max(layer.width * scale, 1),
    height: Math.max(layer.height * scale, 1),
    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
    transformOrigin: 'top left',
    opacity: layer.opacity ?? 1,
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: layer.zIndex,
  };

  if (layer.type === 'text') {
    return {
      ...base,
      boxSizing: 'border-box',
      ...textBorderToCss(layer.style.border, scale),
    };
  }

  if (layer.type === 'shape') {
    if (layer.shape === 'circle') {
      return {
        ...base,
        borderRadius: '50%',
        background: layer.style.fill ?? 'transparent',
        border: layer.style.stroke
          ? `${Math.max((layer.style.strokeWidth ?? 1) * scale, 0.5)}px solid ${layer.style.stroke}`
          : undefined,
      };
    }
    if (layer.shape === 'line') {
      return {
        ...base,
        height: Math.max((layer.style.strokeWidth ?? 1) * scale, 1),
        background: layer.style.stroke ?? '#000',
      };
    }
    return {
      ...base,
      background: layer.style.fill ?? 'transparent',
      border: layer.style.stroke
        ? `${Math.max((layer.style.strokeWidth ?? 1) * scale, 0.5)}px solid ${layer.style.stroke}`
        : undefined,
    };
  }

  if (layer.type === 'image') {
    return {
      ...base,
      background: 'transparent',
    };
  }

  return base;
}

function TextLayerView({ layer, scale }: { layer: TextLayer; scale: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setReady(false);
    try {
      ensureEditorFontLoaded(layer.style.fontFamily);
    } catch {
      /* opcional */
    }

    void paintPublicTextLayer(canvas, layer, scale).then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [layer, scale]);

  return (
    <div style={layerStyle(layer, scale)}>
      <canvas
        ref={canvasRef}
        className="public-page-text-canvas"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          opacity: ready ? 1 : 0,
        }}
        aria-hidden
      />
    </div>
  );
}

export function PublicPageView({
  page,
  pageWidth,
  pageHeight,
  fit = 'width',
}: PublicPageViewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const size = getPageSize(page);
  const width = pageWidth && pageWidth > 0 ? pageWidth : size.width;
  const height = pageHeight && pageHeight > 0 ? pageHeight : size.height;
  const containFit = fit === 'contain';

  const [scale, setScale] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const approxW = Math.max(window.innerWidth || 0, 1);
    if (containFit) {
      const approxH = Math.max(window.innerHeight || 0, 1);
      return Math.min(approxW / width, approxH / height);
    }
    const padded = Math.min(approxW - 24, 920);
    return padded > 0 ? padded / width : 1;
  });

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const frameWidth = el.clientWidth || rect.width || window.innerWidth || 0;
      if (frameWidth <= 0) return;

      if (containFit) {
        const frameHeight =
          el.clientHeight || rect.height || window.innerHeight || frameWidth;
        const sw = frameWidth / width;
        const sh = frameHeight > 0 ? frameHeight / height : sw;
        // Encaja entero: sin barras internas que roben el gesto horizontal.
        setScale(Math.min(sw, sh));
        return;
      }

      setScale(frameWidth / width);
    };

    update();
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      vv?.removeEventListener('resize', update);
    };
  }, [width, height, containFit]);

  const layers = [...page.layers]
    .filter((layer) => layer.visible !== false)
    .sort((a, b) => a.zIndex - b.zIndex);

  const bgColor =
    page.background.type === 'color' ? page.background.value : '#FAF6F0';
  const bgImageUrl =
    page.background.type === 'image' && page.background.value
      ? normalizeAssetUrl(page.background.value)
      : null;
  const renderedWidth = Math.max(width * scale, 1);
  const renderedHeight = Math.max(height * scale, 1);

  const canvas = (
    <div
      className="public-page-frame public-canvas"
      style={{
        width: containFit ? renderedWidth : '100%',
        maxWidth: containFit ? renderedWidth : 'min(920px, 100%)',
        height: renderedHeight,
        minHeight: renderedHeight,
        flexShrink: 0,
        aspectRatio: `${width} / ${height}`,
        background: bgImageUrl ? 'transparent' : bgColor,
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {bgImageUrl ? (
        <img
          className="public-page-bg"
          src={bgImageUrl}
          alt=""
          draggable={false}
          decoding="async"
        />
      ) : null}

      {layers.map((layer) => {
        if (layer.type === 'text') {
          return <TextLayerView key={layer.id} layer={layer} scale={scale} />;
        }

        if (layer.type === 'image') {
          return (
            <div key={layer.id} style={layerStyle(layer, scale)}>
              <img
                className="public-page-layer-image"
                src={normalizeAssetUrl(layer.src)}
                alt=""
                draggable={false}
                decoding="async"
              />
            </div>
          );
        }

        return <div key={layer.id} style={layerStyle(layer, scale)} />;
      })}
    </div>
  );

  const letterboxStyle: React.CSSProperties = bgImageUrl
    ? {
        backgroundColor: bgColor,
        backgroundImage: `url(${bgImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { background: bgColor };

  if (containFit) {
    return (
      <div
        ref={frameRef}
        className="public-page-viewport public-page-viewport--contain"
        style={letterboxStyle}
      >
        {canvas}
      </div>
    );
  }

  return (
    <div
      ref={frameRef}
      className="public-page-viewport-vertical"
      style={{
        width: '100%',
        maxWidth: '100%',
        ...letterboxStyle,
      }}
    >
      {canvas}
    </div>
  );
}
