import { useEffect, useRef, useState } from 'react';
import type { CanvasLayer, MenuPage, TextLayer } from '@/types/canvas';
import { normalizeAssetUrl } from '@/lib/asset-url';
import { ensureEditorFontLoaded } from '@/lib/google-fonts';
import { getPageSize } from '@/lib/page-size';
import { renderTextContentWithCharStyles } from '@/lib/text-char-styles';

interface PublicPageViewProps {
  page: MenuPage;
  pageWidth?: number;
  pageHeight?: number;
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
  };

  if (layer.type === 'text') {
    return {
      ...base,
      height: 'auto',
      minHeight: layer.height * scale,
      color: layer.style.color,
      fontFamily: layer.style.fontFamily,
      fontSize: Math.max(layer.style.fontSize * scale, 4),
      fontWeight: layer.style.fontWeight,
      fontStyle: layer.style.fontStyle,
      textAlign: layer.style.align,
      whiteSpace: 'pre-wrap',
      lineHeight: 1.2,
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
      background: '#d4d4d8',
    };
  }

  return base;
}

function TextLayerView({ layer, scale }: { layer: TextLayer; scale: number }) {
  useEffect(() => {
    try {
      ensureEditorFontLoaded(layer.style.fontFamily);
      if (!layer.charStyles) return;
      for (const line of Object.values(layer.charStyles)) {
        for (const style of Object.values(line)) {
          if (typeof style.fontFamily === 'string') {
            ensureEditorFontLoaded(style.fontFamily);
          }
        }
      }
    } catch {
      /* fuentes opcionales */
    }
  }, [layer]);

  return (
    <div style={layerStyle(layer, scale)}>
      {renderTextContentWithCharStyles(
        layer.content,
        layer.charStyles,
        {
          color: layer.style.color,
          fontFamily: layer.style.fontFamily,
          fontSize: layer.style.fontSize,
          fontWeight: layer.style.fontWeight,
          fontStyle: layer.style.fontStyle,
        },
        scale,
      )}
    </div>
  );
}

export function PublicPageView({
  page,
  pageWidth,
  pageHeight,
}: PublicPageViewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const size = getPageSize(page);
  const width = pageWidth && pageWidth > 0 ? pageWidth : size.width;
  const height = pageHeight && pageHeight > 0 ? pageHeight : size.height;

  // Escala inicial segura (móvil): no depender de un clientWidth 0 en el primer paint.
  const [scale, setScale] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const approx = Math.min(window.innerWidth - 24, 920);
    return approx > 0 ? approx / width : 1;
  });

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    const update = () => {
      const frameWidth =
        el.clientWidth ||
        el.getBoundingClientRect().width ||
        Math.min(window.innerWidth - 24, 920);
      if (frameWidth > 0) {
        setScale(frameWidth / width);
      }
    };

    update();
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [width]);

  const layers = [...page.layers]
    .filter((layer) => layer.visible !== false)
    .sort((a, b) => a.zIndex - b.zIndex);

  const bgColor =
    page.background.type === 'color' ? page.background.value : '#FAF6F0';
  const renderedHeight = Math.max(height * scale, 1);

  return (
    <div
      ref={frameRef}
      className="public-page-frame public-canvas"
      style={{
        width: '100%',
        maxWidth: 'min(920px, 100%)',
        height: renderedHeight,
        minHeight: renderedHeight,
        aspectRatio: `${width} / ${height}`,
        background: page.background.type === 'color' ? bgColor : '#FAF6F0',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {page.background.type === 'image' && page.background.value ? (
        <img
          className="public-page-bg"
          src={normalizeAssetUrl(page.background.value)}
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
}
