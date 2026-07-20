import {
  Canvas,
  Circle,
  FabricImage,
  FabricObject,
  Line,
  Rect,
  Textbox,
} from 'fabric';
import type {
  CanvasData,
  CanvasLayer,
  ImageLayer,
  MenuPage,
  ShapeLayer,
  TextLayer,
} from '@/types/canvas';
import { A4_HEIGHT, A4_WIDTH, normalizeCanvasData } from '@/types/canvas';

const ORIGIN = { originX: 'left' as const, originY: 'top' as const };

export function isTextObject(obj: FabricObject): boolean {
  return obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text';
}

export function isImageObject(obj: FabricObject): boolean {
  return obj.type === 'image';
}

export function isShapeObject(obj: FabricObject): boolean {
  return obj.type === 'rect' || obj.type === 'circle' || obj.type === 'line';
}

function toHexColor(value: unknown, fallback = '#000000'): string {
  if (typeof value !== 'string' || !value) return fallback;
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const r = value[1];
    const g = value[2];
    const b = value[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  const rgb = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgb) {
    const hex = (n: string) => Number(n).toString(16).padStart(2, '0');
    return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`;
  }
  return fallback;
}

export { toHexColor };

export function layerToFabricObject(layer: CanvasLayer): FabricObject | null {
  const common = {
    ...ORIGIN,
    left: layer.x,
    top: layer.y,
    angle: layer.rotation ?? 0,
    opacity: layer.opacity ?? (layer.type === 'shape' ? (layer as ShapeLayer).style.opacity : undefined) ?? 1,
    visible: layer.visible !== false,
    selectable: layer.locked !== true,
    evented: layer.locked !== true,
  };

  if (layer.type === 'text') {
    const textLayer = layer as TextLayer;
    const obj = new Textbox(textLayer.content, {
      ...common,
      width: textLayer.width,
      fontFamily: textLayer.style.fontFamily,
      fontSize: textLayer.style.fontSize,
      fill: textLayer.style.color,
      textAlign: textLayer.style.align,
      fontWeight: textLayer.style.fontWeight ?? 'normal',
    });
    (obj as FabricObject & { data?: unknown }).data = {
      layerId: layer.id,
      layerType: layer.type,
    };
    return obj;
  }

  if (layer.type === 'shape') {
    const shapeLayer = layer as ShapeLayer;
    let obj: FabricObject;

    if (shapeLayer.shape === 'line') {
      obj = new Line([0, 0, shapeLayer.width, Math.max(shapeLayer.height, 0)], {
        ...common,
        stroke: shapeLayer.style.stroke ?? '#000',
        strokeWidth: shapeLayer.style.strokeWidth ?? 1,
        fill: '',
      });
    } else if (shapeLayer.shape === 'circle') {
      obj = new Circle({
        ...common,
        radius: Math.min(shapeLayer.width, shapeLayer.height) / 2,
        fill: shapeLayer.style.fill ?? 'transparent',
        stroke: shapeLayer.style.stroke,
        strokeWidth: shapeLayer.style.strokeWidth ?? 0,
      });
    } else {
      obj = new Rect({
        ...common,
        width: shapeLayer.width,
        height: shapeLayer.height,
        fill: shapeLayer.style.fill ?? 'transparent',
        stroke: shapeLayer.style.stroke,
        strokeWidth: shapeLayer.style.strokeWidth ?? 0,
      });
    }

    (obj as FabricObject & { data?: unknown }).data = {
      layerId: layer.id,
      layerType: 'shape',
      shape: shapeLayer.shape,
    };
    return obj;
  }

  return null;
}

export async function imageLayerToFabricObject(layer: ImageLayer): Promise<FabricImage> {
  const isRelative = layer.src.startsWith('/');
  const img = await FabricImage.fromURL(
    layer.src,
    isRelative ? undefined : { crossOrigin: 'anonymous' },
  );

  img.set({
    ...ORIGIN,
    left: layer.x,
    top: layer.y,
    angle: layer.rotation ?? 0,
    opacity: layer.opacity ?? 1,
    visible: layer.visible !== false,
    selectable: layer.locked !== true,
    evented: layer.locked !== true,
  });

  (img as FabricObject & { data?: unknown }).data = {
    layerId: layer.id,
    layerType: 'image',
    src: layer.src,
    assetId: (layer as ImageLayer & { assetId?: string }).assetId,
  };

  if (layer.width > 0) {
    img.scaleToWidth(layer.width);
  }

  return img;
}

export async function loadPageOntoCanvas(
  canvas: Canvas,
  page: MenuPage,
  width = A4_WIDTH,
  height = A4_HEIGHT,
): Promise<void> {
  canvas.clear();
  canvas.backgroundImage = undefined;
  canvas.setDimensions({ width, height });

  if (page.background.type === 'color') {
    canvas.backgroundColor = page.background.value;
  } else if (page.background.type === 'image' && page.background.value) {
    try {
      const bg = await FabricImage.fromURL(
        page.background.value,
        page.background.value.startsWith('/') ? undefined : { crossOrigin: 'anonymous' },
      );
      bg.set({ ...ORIGIN, left: 0, top: 0, selectable: false, evented: false });
      bg.scaleToWidth(width);
      canvas.backgroundImage = bg;
    } catch {
      canvas.backgroundColor = '#FAF6F0';
    }
  }

  const sorted = [...page.layers].sort((a, b) => a.zIndex - b.zIndex);

  for (const layer of sorted) {
    if (layer.type === 'image') {
      try {
        const img = await imageLayerToFabricObject(layer as ImageLayer);
        canvas.add(img);
      } catch (err) {
        console.error('No se pudo cargar imagen de capa', err);
      }
    } else {
      const obj = layerToFabricObject(layer);
      if (obj) canvas.add(obj);
    }
  }

  canvas.requestRenderAll();
}

/** @deprecated usa loadPageOntoCanvas; carga la primera página de un documento */
export async function loadCanvasData(canvas: Canvas, data: CanvasData): Promise<void> {
  const doc = normalizeCanvasData(data);
  const page = doc.pages[0];
  if (!page) return;
  await loadPageOntoCanvas(canvas, page, doc.width, doc.height);
}

export function fabricObjectToLayer(obj: FabricObject, zIndex: number): CanvasLayer | null {
  const data =
    ((obj as FabricObject & { data?: { layerId?: string; layerType?: string; src?: string; shape?: string } })
      .data) ?? {};
  const id = data.layerId ?? crypto.randomUUID();
  const base = {
    id,
    x: obj.left ?? 0,
    y: obj.top ?? 0,
    width: (obj.width ?? 0) * (obj.scaleX ?? 1),
    height: (obj.height ?? 0) * (obj.scaleY ?? 1),
    rotation: obj.angle ?? 0,
    zIndex,
    visible: obj.visible !== false,
    locked: obj.selectable === false,
    opacity: obj.opacity ?? 1,
  };

  if (isTextObject(obj)) {
    const textObj = obj as Textbox;
    return {
      ...base,
      type: 'text',
      content: textObj.text ?? '',
      style: {
        fontFamily: textObj.fontFamily ?? 'Arial',
        fontSize: textObj.fontSize ?? 16,
        color: toHexColor(textObj.fill, '#000000'),
        align: (textObj.textAlign as 'left' | 'center' | 'right') ?? 'left',
        fontWeight: textObj.fontWeight as string | undefined,
        opacity: textObj.opacity,
      },
    } as TextLayer;
  }

  if (isImageObject(obj)) {
    const imageObj = obj as FabricImage;
    return {
      ...base,
      type: 'image',
      src: data.src ?? imageObj.getSrc() ?? '',
    } as ImageLayer;
  }

  if (obj.type === 'line' || obj instanceof Line) {
    const line = obj as Line;
    return {
      ...base,
      type: 'shape',
      shape: 'line',
      width: (line.x2 ?? 0) - (line.x1 ?? 0),
      height: (line.y2 ?? 0) - (line.y1 ?? 0),
      style: {
        stroke: toHexColor(line.stroke, '#000000'),
        strokeWidth: line.strokeWidth ?? 1,
        opacity: line.opacity,
      },
    } as ShapeLayer;
  }

  if (obj.type === 'circle' || obj instanceof Circle) {
    const circle = obj as Circle;
    const radius = circle.radius ?? 0;
    return {
      ...base,
      type: 'shape',
      shape: 'circle',
      width: radius * 2 * (circle.scaleX ?? 1),
      height: radius * 2 * (circle.scaleY ?? 1),
      style: {
        fill: toHexColor(circle.fill, '#cccccc'),
        stroke: circle.stroke ? toHexColor(circle.stroke) : undefined,
        strokeWidth: circle.strokeWidth ?? 0,
        opacity: circle.opacity,
      },
    } as ShapeLayer;
  }

  if (obj.type === 'rect' || obj instanceof Rect) {
    const rect = obj as Rect;
    return {
      ...base,
      type: 'shape',
      shape: 'rect',
      style: {
        fill: toHexColor(rect.fill, '#cccccc'),
        stroke: rect.stroke ? toHexColor(rect.stroke) : undefined,
        strokeWidth: rect.strokeWidth ?? 0,
        opacity: rect.opacity,
      },
    } as ShapeLayer;
  }

  return null;
}

export function canvasToPageData(canvas: Canvas, pageId: string): MenuPage {
  const objects = canvas.getObjects();
  const layers: CanvasLayer[] = objects
    .map((obj, index) => fabricObjectToLayer(obj, index + 1))
    .filter((l): l is CanvasLayer => l !== null);

  const bg = canvas.backgroundColor;
  const background =
    typeof bg === 'string'
      ? { type: 'color' as const, value: bg }
      : { type: 'color' as const, value: '#FFFFFF' };

  return {
    id: pageId,
    background,
    layers,
  };
}

/** Documento de una sola página (compat / utilidades) */
export function canvasToCanvasData(canvas: Canvas, pageId = 'page_1'): CanvasData {
  return {
    width: canvas.getWidth() || A4_WIDTH,
    height: canvas.getHeight() || A4_HEIGHT,
    pages: [canvasToPageData(canvas, pageId)],
  };
}

export function createTextLayer(x = 80, y = 120): TextLayer {
  return {
    id: `layer_${crypto.randomUUID().slice(0, 8)}`,
    type: 'text',
    content: 'Nuevo texto',
    x,
    y,
    width: 280,
    height: 40,
    rotation: 0,
    zIndex: 1,
    style: {
      fontFamily: 'Arial',
      fontSize: 22,
      color: '#333333',
      align: 'left',
    },
  };
}

export function createShapeLayer(
  shape: 'rect' | 'line' | 'circle',
  x = 80,
  y = 120,
): ShapeLayer {
  return {
    id: `layer_${crypto.randomUUID().slice(0, 8)}`,
    type: 'shape',
    shape,
    x,
    y,
    width: shape === 'line' ? 300 : 120,
    height: shape === 'line' ? 0 : 80,
    rotation: 0,
    zIndex: 1,
    style: {
      fill: shape === 'line' ? undefined : '#cccccc',
      stroke: '#333333',
      strokeWidth: shape === 'line' ? 2 : 1,
    },
  };
}

export async function addLayerToCanvas(canvas: Canvas, layer: CanvasLayer): Promise<void> {
  if (layer.type === 'image') {
    const img = await imageLayerToFabricObject(layer as ImageLayer);
    canvas.add(img);
    canvas.setActiveObject(img);
  } else {
    const obj = layerToFabricObject(layer);
    if (obj) {
      canvas.add(obj);
      canvas.setActiveObject(obj);
    }
  }
  canvas.requestRenderAll();
}

/**
 * Ajusta una imagen al lienzo A4.
 * - cover: llena todo el A4 (recorta si hace falta)
 * - contain: cabe entera dentro del A4 sin recortar
 */
export function fitImageToA4(
  img: FabricImage,
  canvas: Canvas,
  mode: 'cover' | 'contain' = 'cover',
): void {
  const cw = canvas.getWidth();
  const ch = canvas.getHeight();
  const iw = img.width || 1;
  const ih = img.height || 1;

  const scale =
    mode === 'cover' ? Math.max(cw / iw, ch / ih) : Math.min(cw / iw, ch / ih);

  const scaledW = iw * scale;
  const scaledH = ih * scale;

  img.set({
    originX: 'left',
    originY: 'top',
    scaleX: scale,
    scaleY: scale,
    left: (cw - scaledW) / 2,
    top: (ch - scaledH) / 2,
    angle: 0,
  });
  img.setCoords();
  canvas.sendObjectToBack(img);
  canvas.setActiveObject(img);
  canvas.requestRenderAll();
}

export function ensureA4Canvas(canvas: Canvas): void {
  if (canvas.getWidth() !== A4_WIDTH || canvas.getHeight() !== A4_HEIGHT) {
    canvas.setDimensions({ width: A4_WIDTH, height: A4_HEIGHT });
    canvas.requestRenderAll();
  }
}
