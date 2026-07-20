import type { CanvasData, CanvasLayer } from '@/types/canvas';
import { normalizeCanvasData } from '@/types/canvas';

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
      backgroundImage: `url(${layer.src})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }

  return base;
}

export function TemplatePreview({ canvasData, name }: TemplatePreviewProps) {
  const doc = normalizeCanvasData(canvasData);
  const page = doc.pages[0];
  if (!page) return null;

  const scale = 200 / doc.width;
  const height = doc.height * scale;
  const bg = page.background.type === 'color' ? page.background.value : '#f4f4f5';
  const layers = [...page.layers].sort((a, b) => a.zIndex - b.zIndex);
  const extraPages = doc.pages.length > 1 ? doc.pages.length - 1 : 0;

  return (
    <div
      className="template-preview-canvas"
      style={{ height, background: bg }}
      title={name}
      aria-label={`Vista previa de ${name}`}
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
  );
}
