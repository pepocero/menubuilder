import {
  type ConverterCanvasData,
  type ConverterImageLayer,
  type ConverterLayer,
  type ConverterPage,
  type ConverterShapeLayer,
  type ConverterTextLayer,
  normalizeConverterCanvasData,
} from './canvas-input';
import {
  MENU_DOCUMENT_VERSION,
  type MenuDocument,
  type MenuDocumentDividerElement,
  type MenuDocumentElement,
  type MenuDocumentImageElement,
  type MenuDocumentMeta,
  type MenuDocumentPage,
  type MenuDocumentShapeElement,
  type MenuDocumentTextElement,
  type Percent,
} from './types';

const DEFAULT_CANVAS_W = 595;
const DEFAULT_CANVAS_H = 842;

function toPercent(value: number, total: number): Percent {
  if (total <= 0) return 0;
  return Math.round((value / total) * 10000) / 100;
}

function inferSemantic(fontSize: number, canvasHeight: number): MenuDocumentTextElement['semantic'] {
  const ratio = fontSize / canvasHeight;
  if (ratio >= 0.045) return 'heading';
  if (ratio >= 0.028) return 'subheading';
  if (ratio <= 0.012) return 'caption';
  return 'body';
}

function convertTextLayer(
  layer: ConverterTextLayer,
  canvasW: number,
  canvasH: number,
): MenuDocumentTextElement {
  return {
    id: layer.id,
    type: 'text',
    text: layer.content,
    x: toPercent(layer.x, canvasW),
    y: toPercent(layer.y, canvasH),
    width: toPercent(layer.width, canvasW),
    height: toPercent(layer.height, canvasH),
    rotation: layer.rotation,
    opacity: layer.opacity ?? layer.style.opacity,
    zIndex: layer.zIndex,
    semantic: inferSemantic(layer.style.fontSize, canvasH),
    style: {
      fontFamily: layer.style.fontFamily,
      fontSize: toPercent(layer.style.fontSize, canvasW),
      fontWeight: layer.style.fontWeight,
      lineHeight: 1.2,
      letterSpacing: 0,
      textAlign: layer.style.align,
      textTransform: 'none',
      color: layer.style.color,
    },
  };
}

function convertImageLayer(
  layer: ConverterImageLayer,
  canvasW: number,
  canvasH: number,
): MenuDocumentImageElement {
  return {
    id: layer.id,
    type: 'image',
    src: layer.src,
    alt: '',
    objectFit: 'cover',
    x: toPercent(layer.x, canvasW),
    y: toPercent(layer.y, canvasH),
    width: toPercent(layer.width, canvasW),
    height: toPercent(layer.height, canvasH),
    rotation: layer.rotation,
    opacity: layer.opacity,
    zIndex: layer.zIndex,
  };
}

function convertShapeLayer(
  layer: ConverterShapeLayer,
  canvasW: number,
  canvasH: number,
): MenuDocumentShapeElement | MenuDocumentDividerElement | null {
  if (layer.shape === 'line') {
    const thickness = layer.style.strokeWidth ?? 1;
    return {
      id: layer.id,
      type: 'divider',
      color: layer.style.stroke ?? '#000000',
      thickness: toPercent(thickness, canvasW),
      x: toPercent(layer.x, canvasW),
      y: toPercent(layer.y, canvasH),
      width: toPercent(Math.max(layer.width, 1), canvasW),
      height: toPercent(thickness, canvasH),
      rotation: layer.rotation,
      opacity: layer.opacity ?? layer.style.opacity,
      zIndex: layer.zIndex,
    };
  }

  return {
    id: layer.id,
    type: 'shape',
    shape: layer.shape === 'circle' ? 'circle' : 'rect',
    fill: layer.style.fill,
    stroke: layer.style.stroke,
    strokeWidth: layer.style.strokeWidth
      ? toPercent(layer.style.strokeWidth, canvasW)
      : undefined,
    x: toPercent(layer.x, canvasW),
    y: toPercent(layer.y, canvasH),
    width: toPercent(layer.width, canvasW),
    height: toPercent(layer.height, canvasH),
    rotation: layer.rotation,
    opacity: layer.opacity ?? layer.style.opacity,
    zIndex: layer.zIndex,
  };
}

function convertLayer(
  layer: ConverterLayer,
  canvasW: number,
  canvasH: number,
): MenuDocumentElement | null {
  if (layer.visible === false) return null;

  if (layer.type === 'text') {
    return convertTextLayer(layer, canvasW, canvasH);
  }
  if (layer.type === 'image') {
    return convertImageLayer(layer, canvasW, canvasH);
  }
  if (layer.type === 'shape') {
    return convertShapeLayer(layer, canvasW, canvasH);
  }
  return null;
}

function convertPage(page: ConverterPage, canvasW: number, canvasH: number): MenuDocumentPage {
  const backgroundColor =
    page.background.type === 'color' ? page.background.value : '#FAF6F0';

  const elements = [...page.layers]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((layer) => convertLayer(layer, canvasW, canvasH))
    .filter((el): el is MenuDocumentElement => el !== null);

  return {
    id: page.id,
    canvas: {
      width: canvasW,
      height: canvasH,
      background: backgroundColor,
      ...(page.background.type === 'image' && page.background.value
        ? { backgroundImage: page.background.value }
        : {}),
    },
    elements,
  };
}

export function canvasDataToMenuDocument(
  raw: unknown,
  meta?: MenuDocumentMeta,
): MenuDocument | null {
  const data = normalizeConverterCanvasData(raw);
  if (!data || data.pages.length === 0) return null;

  const canvasW = data.width || DEFAULT_CANVAS_W;
  const canvasH = data.height || DEFAULT_CANVAS_H;

  return {
    version: MENU_DOCUMENT_VERSION,
    meta: meta
      ? { ...meta, exportedAt: meta.exportedAt ?? new Date().toISOString() }
      : { exportedAt: new Date().toISOString() },
    pages: data.pages.map((page) => {
      const pageW =
        typeof page.width === 'number' && page.width > 0 ? page.width : canvasW;
      const pageH =
        typeof page.height === 'number' && page.height > 0 ? page.height : canvasH;
      return convertPage(page, pageW, pageH);
    }),
  };
}

export function menuDocumentFromCanvasData(
  data: ConverterCanvasData,
  meta?: MenuDocumentMeta,
): MenuDocument | null {
  return canvasDataToMenuDocument(data, meta);
}

export function serializeMenuDocument(doc: MenuDocument): string {
  return JSON.stringify(doc);
}

export function parseMenuDocument(raw: unknown): MenuDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (d.version !== MENU_DOCUMENT_VERSION) return null;
  if (!Array.isArray(d.pages) || d.pages.length === 0) return null;

  const pagesValid = d.pages.every((p) => {
    if (!p || typeof p !== 'object') return false;
    const page = p as Record<string, unknown>;
    return (
      typeof page.id === 'string' &&
      page.canvas !== null &&
      typeof page.canvas === 'object' &&
      Array.isArray(page.elements)
    );
  });

  if (!pagesValid) return null;
  return d as unknown as MenuDocument;
}

function fromPercent(pct: number, total: number): number {
  if (!Number.isFinite(pct) || total <= 0) return 0;
  return (pct / 100) * total;
}

function elementToLayer(
  el: MenuDocumentElement,
  canvasW: number,
  canvasH: number,
): ConverterLayer | null {
  const base = {
    id: el.id,
    x: fromPercent(el.x, canvasW),
    y: fromPercent(el.y, canvasH),
    width: Math.max(fromPercent(el.width, canvasW), 1),
    height: Math.max(fromPercent(el.height, canvasH), 1),
    rotation: el.rotation ?? 0,
    zIndex: typeof el.zIndex === 'number' ? el.zIndex : 1,
    opacity: el.opacity,
  };

  if (el.type === 'text') {
    return {
      ...base,
      type: 'text',
      content: el.text,
      style: {
        fontFamily: el.style.fontFamily || 'Arial',
        fontSize: Math.max(fromPercent(el.style.fontSize, canvasW), 8),
        color: el.style.color || '#1a1a1a',
        align: el.style.textAlign || 'left',
        fontWeight: el.style.fontWeight,
      },
    };
  }

  if (el.type === 'image') {
    return {
      ...base,
      type: 'image',
      src: el.src,
    };
  }

  if (el.type === 'shape') {
    return {
      ...base,
      type: 'shape',
      shape: el.shape === 'circle' ? 'circle' : 'rect',
      style: {
        fill: el.fill,
        stroke: el.stroke,
        strokeWidth: el.strokeWidth
          ? Math.max(fromPercent(el.strokeWidth, canvasW), 0)
          : undefined,
        opacity: el.opacity,
      },
    };
  }

  if (el.type === 'divider') {
    const thickness = Math.max(fromPercent(el.thickness, canvasW), 1);
    return {
      ...base,
      type: 'shape',
      shape: 'line',
      height: thickness,
      style: {
        stroke: el.color || '#000000',
        strokeWidth: thickness,
        opacity: el.opacity,
      },
    };
  }

  return null;
}

/** Convierte un MenuDocument exportado de vuelta a CanvasData del editor. */
export function menuDocumentToCanvasData(doc: MenuDocument): ConverterCanvasData {
  const first = doc.pages[0];
  const width = first?.canvas?.width || DEFAULT_CANVAS_W;
  const height = first?.canvas?.height || DEFAULT_CANVAS_H;

  const pages = doc.pages.map((page, index) => {
    const canvasW = page.canvas?.width || width;
    const canvasH = page.canvas?.height || height;
    const layers = page.elements
      .map((el) => elementToLayer(el, canvasW, canvasH))
      .filter((layer): layer is ConverterLayer => layer !== null)
      .sort((a, b) => a.zIndex - b.zIndex);

    const bgImage = page.canvas?.backgroundImage;
    return {
      id: page.id || `page_${index + 1}`,
      background: bgImage
        ? { type: 'image' as const, value: bgImage }
        : {
            type: 'color' as const,
            value: page.canvas?.background || '#FAF6F0',
          },
      layers,
      width: canvasW,
      height: canvasH,
    };
  });

  return { width, height, pages };
}

/**
 * Acepta menu.json (MenuDocument v1) o CanvasData del editor.
 * Devuelve null si el JSON no es reconocible.
 */
export function importJsonToCanvasData(raw: unknown): ConverterCanvasData | null {
  const doc = parseMenuDocument(raw);
  if (doc) return menuDocumentToCanvasData(doc);

  const normalized = normalizeConverterCanvasData(raw);
  if (normalized && normalized.pages.length > 0) return normalized;
  return null;
}
