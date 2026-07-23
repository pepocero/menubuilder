import { useEffect, useRef, useState } from 'react';
import type { CanvasLayer, MenuPage, TextLayer } from '@/types/canvas';
import { normalizeAssetUrl } from '@/lib/asset-url';
import { ensureEditorFontLoaded } from '@/lib/google-fonts';
import { getPageSize } from '@/lib/page-size';
import { textBorderToCss } from '@/lib/text-border';
import { renderTextContentWithCharStyles } from '@/lib/text-char-styles';

interface PublicPageViewProps {
  page: MenuPage;
  pageWidth?: number;
  pageHeight?: number;
  /**
   * `width`: escala al ancho del contenedor (vista vertical).
   * `contain`: encaja ancho y alto sin desbordar (scroll horizontal a pantalla completa).
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
      // Misma caja que el editor (Fabric). height:auto hacía crecer el texto y solaparse.
      boxSizing: 'border-box',
      color: layer.style.color,
      fontFamily: layer.style.fontFamily,
      fontSize: Math.max(layer.style.fontSize * scale, 4),
      fontWeight: layer.style.fontWeight,
      fontStyle: layer.style.fontStyle,
      textAlign: layer.style.align,
      whiteSpace: 'pre-wrap',
      // Fabric Textbox usa ~1.16 por defecto si no se guarda lineHeight.
      lineHeight: 1.16,
      overflow: 'hidden',
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
      // Sin fondo opaco: los PNG con alpha deben dejar ver las capas de debajo
      // (como en Fabric). Un gris de “placeholder” tapaba el pergamino.
      background: 'transparent',
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
  fit = 'width',
}: PublicPageViewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const size = getPageSize(page);
  const width = pageWidth && pageWidth > 0 ? pageWidth : size.width;
  const height = pageHeight && pageHeight > 0 ? pageHeight : size.height;

  // Escala inicial segura (móvil): no depender de un clientWidth 0 en el primer paint.
  const [scale, setScale] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const approxW = Math.min(window.innerWidth - 24, 920);
    if (fit === 'contain') {
      const approxH = window.innerHeight || approxW;
      const sw = approxW > 0 ? approxW / width : 1;
      const sh = approxH > 0 ? approxH / height : 1;
      return Math.min(sw, sh);
    }
    return approxW > 0 ? approxW / width : 1;
  });

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const frameWidth =
        el.clientWidth ||
        rect.width ||
        Math.min(window.innerWidth - 24, 920);
      if (frameWidth <= 0) return;

      if (fit === 'contain') {
        const frameHeight =
          el.clientHeight || rect.height || window.innerHeight || frameWidth;
        const sw = frameWidth / width;
        const sh = frameHeight > 0 ? frameHeight / height : sw;
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
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [width, height, fit]);

  const layers = [...page.layers]
    .filter((layer) => layer.visible !== false)
    .sort((a, b) => a.zIndex - b.zIndex);

  const bgColor =
    page.background.type === 'color' ? page.background.value : '#FAF6F0';
  const renderedWidth = Math.max(width * scale, 1);
  const renderedHeight = Math.max(height * scale, 1);

  const canvas = (
    <div
      className="public-page-frame public-canvas"
      style={{
        width: fit === 'contain' ? renderedWidth : '100%',
        maxWidth: fit === 'contain' ? renderedWidth : 'min(920px, 100%)',
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

  if (fit === 'contain') {
    return (
      <div ref={frameRef} className="public-page-viewport">
        {canvas}
      </div>
    );
  }

  return (
    <div ref={frameRef} style={{ width: '100%', maxWidth: 'min(920px, 100%)' }}>
      {canvas}
    </div>
  );
}
