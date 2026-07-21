import { useEffect, useRef, useState } from 'react';
import type { CanvasLayer, MenuPage } from '@/types/canvas';
import { A4_HEIGHT, A4_WIDTH } from '@/types/canvas';

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

export function PublicPageView({
  page,
  pageWidth = A4_WIDTH,
  pageHeight = A4_HEIGHT,
}: PublicPageViewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth;
      if (width > 0) {
        setScale(width / pageWidth);
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageWidth]);

  const layers = [...page.layers]
    .filter((layer) => layer.visible !== false)
    .sort((a, b) => a.zIndex - b.zIndex);

  const bgColor =
    page.background.type === 'color' ? page.background.value : '#FAF6F0';

  return (
    <div
      ref={frameRef}
      className="public-page-frame editor-canvas-wrap public-canvas"
      style={{
        aspectRatio: `${pageWidth} / ${pageHeight}`,
        background: page.background.type === 'color' ? bgColor : '#FAF6F0',
      }}
    >
      {page.background.type === 'image' && page.background.value ? (
        <img
          className="public-page-bg"
          src={page.background.value}
          alt=""
          draggable={false}
          decoding="async"
        />
      ) : null}

      {layers.map((layer) => {
        if (layer.type === 'text') {
          return (
            <div key={layer.id} style={layerStyle(layer, scale)}>
              {layer.content}
            </div>
          );
        }

        if (layer.type === 'image') {
          return (
            <div key={layer.id} style={layerStyle(layer, scale)}>
              <img
                className="public-page-layer-image"
                src={layer.src}
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
