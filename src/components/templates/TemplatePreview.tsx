import { useEffect, useRef, useState } from 'react';
import type { CanvasData, CanvasLayer } from '@/types/canvas';
import { normalizeCanvasData } from '@/types/canvas';
import { textBorderToCss } from '@/lib/text-border';

interface TemplatePreviewProps {
  canvasData: CanvasData;
  name: string;
}

function layerPreviewStyle(layer: CanvasLayer, scale: number): React.CSSProperties {
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
      backgroundImage: `url(${layer.src})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }

  return base;
}

export function TemplatePreview({ canvasData, name }: TemplatePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const doc = normalizeCanvasData(canvasData);
  const page = doc.pages[0];

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setBox({ width: rect.width, height: rect.height });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!page) return null;

  const scale =
    box.width > 0 && box.height > 0
      ? Math.min(box.width / doc.width, box.height / doc.height)
      : 0;
  const previewW = doc.width * scale;
  const previewH = doc.height * scale;
  const bg = page.background.type === 'color' ? page.background.value : '#f4f4f5';
  const layers = [...page.layers].sort((a, b) => a.zIndex - b.zIndex);
  const extraPages = doc.pages.length > 1 ? doc.pages.length - 1 : 0;

  return (
    <div
      ref={containerRef}
      className="template-preview-canvas"
      title={name}
      aria-label={`Vista previa de ${name}`}
    >
      {scale > 0 && (
        <div
          className="template-preview-stage"
          style={{
            width: previewW,
            height: previewH,
            background: bg,
          }}
        >
          {layers.map((layer) =>
            layer.type === 'text' ? (
              <div key={layer.id} style={layerPreviewStyle(layer, scale)}>
                {layer.content}
              </div>
            ) : (
              <div key={layer.id} style={layerPreviewStyle(layer, scale)} />
            ),
          )}
          {extraPages > 0 && (
            <span className="template-pages-badge">+{extraPages} pág.</span>
          )}
        </div>
      )}
    </div>
  );
}
