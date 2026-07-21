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
    pages: data.pages.map((page) => convertPage(page, canvasW, canvasH)),
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
