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
import {
  normalizeTextBorder,
  syncTextboxBorder,
  textBorderIsVisible,
} from '@/lib/text-border';

type CanvasWithLogicalSize = Canvas & {
  __logicalWidth?: number;
  __logicalHeight?: number;
};

export function setCanvasLogicalSize(canvas: Canvas, width: number, height: number): void {
  const c = canvas as CanvasWithLogicalSize;
  c.__logicalWidth = width;
  c.__logicalHeight = height;
}

export function getCanvasLogicalSize(canvas: Canvas): { width: number; height: number } {
  const c = canvas as CanvasWithLogicalSize;
  return {
    width:
      typeof c.__logicalWidth === 'number' && c.__logicalWidth > 0
        ? c.__logicalWidth
        : A4_WIDTH,
    height:
      typeof c.__logicalHeight === 'number' && c.__logicalHeight > 0
        ? c.__logicalHeight
        : A4_HEIGHT,
  };
}

const ORIGIN = { originX: 'left' as const, originY: 'top' as const };

function layerDataFromLayer(layer: CanvasLayer) {
  return {
    layerId: layer.id,
    layerType: layer.type,
    layerName: layer.name,
    locked: layer.locked === true,
  };
}

export function isTextObject(obj: FabricObject): boolean {
  return obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text';
}

export function isImageObject(obj: FabricObject): boolean {
  return obj.type === 'image';
}

export function isShapeObject(obj: FabricObject): boolean {
  return obj.type === 'rect' || obj.type === 'circle' || obj.type === 'line';
}

/**
 * Tras pegar texto largo, Fabric a menudo deja un ancho/alto inválidos.
 * Normaliza el Textbox para que vuelva a verse y quepa en el A4.
 * Por defecto NO borra estilos por carácter (negrita parcial, etc.).
 */
export function refreshTextboxLayout(
  obj: FabricObject,
  options?: { clearCharStyles?: boolean },
): void {
  if (!isTextObject(obj)) return;

  const text = obj as Textbox;
  const content = text.text ?? '';
  const fontSize = Math.max(8, Math.min(120, Number(text.fontSize) || 16));

  if (options?.clearCharStyles) {
    text.styles = {};
    text.set('styles', {});
  }

  let width = Number(text.width) || 0;
  if (!Number.isFinite(width) || width < 48) {
    const estimated = Math.max(160, Math.min(content.length * fontSize * 0.4, A4_WIDTH - 48));
    width = estimated;
  }
  width = Math.min(Math.max(width, 48), A4_WIDTH - 24);

  const fillRaw = text.fill;
  const fill =
    typeof fillRaw === 'string' &&
    fillRaw !== '' &&
    fillRaw !== 'transparent' &&
    fillRaw !== 'rgba(0,0,0,0)'
      ? fillRaw
      : '#333333';

  const scaleX = !Number.isFinite(text.scaleX) || (text.scaleX ?? 1) === 0 ? 1 : text.scaleX;
  const scaleY = !Number.isFinite(text.scaleY) || (text.scaleY ?? 1) === 0 ? 1 : text.scaleY;
  const opacity =
    !Number.isFinite(text.opacity as number) || (text.opacity ?? 1) <= 0
      ? 1
      : (text.opacity as number);

  text.set({
    text: content,
    fontSize,
    width,
    fill,
    scaleX,
    scaleY,
    opacity,
    visible: true,
    dirty: true,
  });

  text.initDimensions();

  const minHeight = fontSize * 1.25;
  if ((text.height ?? 0) < minHeight && content.trim().length > 0) {
    text.set({ text: content, width, dirty: true });
    text.initDimensions();
  }

  text.setCoords();
  text.canvas?.requestRenderAll();
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
      // Ancho fijo; el alto lo recalcula Fabric (initDimensions), no un height guardado.
      width: textLayer.width,
      fontFamily: textLayer.style.fontFamily,
      fontSize: textLayer.style.fontSize,
      fill: textLayer.style.color,
      textAlign: textLayer.style.align,
      fontWeight: textLayer.style.fontWeight ?? 'normal',
      fontStyle:
        textLayer.style.fontStyle === 'italic' || textLayer.style.fontStyle === 'oblique'
          ? textLayer.style.fontStyle
          : 'normal',
      lineHeight:
        typeof textLayer.style.lineHeight === 'number' && textLayer.style.lineHeight > 0
          ? textLayer.style.lineHeight
          : 1.16,
      charSpacing:
        typeof textLayer.style.charSpacing === 'number'
          ? textLayer.style.charSpacing
          : 0,
      styles: textLayer.charStyles ? structuredClone(textLayer.charStyles) : {},
    });
    obj.initDimensions();
    obj.setCoords();
    (obj as FabricObject & { data?: unknown }).data = layerDataFromLayer(layer);
    const border = normalizeTextBorder(textLayer.style.border);
    if (border && textBorderIsVisible(border)) {
      syncTextboxBorder(obj, border);
    }
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
      ...layerDataFromLayer(layer),
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
    ...layerDataFromLayer(layer),
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
  setCanvasLogicalSize(canvas, width, height);
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

  // Textbox: alto según contenido (tras fuentes / métricas reales).
  for (const obj of canvas.getObjects()) {
    if (!isTextObject(obj)) continue;
    const text = obj as Textbox;
    text.set({ dirty: true });
    text.initDimensions();
    text.setCoords();
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
    ((obj as FabricObject & { data?: { layerId?: string; layerType?: string; layerName?: string; locked?: boolean; src?: string; shape?: string } })
      .data) ?? {};
  const id = data.layerId ?? crypto.randomUUID();
  const base = {
    id,
    name: data.layerName?.trim() || undefined,
    x: obj.left ?? 0,
    y: obj.top ?? 0,
    width: (obj.width ?? 0) * (obj.scaleX ?? 1),
    height: (obj.height ?? 0) * (obj.scaleY ?? 1),
    rotation: obj.angle ?? 0,
    zIndex,
    visible: obj.visible !== false,
    locked: typeof data.locked === 'boolean' ? data.locked : obj.selectable === false,
    opacity: obj.opacity ?? 1,
  };

  if (isTextObject(obj)) {
    const textObj = obj as Textbox;
    // Altura = la que Fabric calcula, no un valor divergente previo.
    textObj.initDimensions();
    const charStyles = (() => {
      const styles = textObj.styles;
      if (!styles || typeof styles !== 'object' || Object.keys(styles).length === 0) {
        return undefined;
      }
      try {
        return JSON.parse(JSON.stringify(styles)) as TextLayer['charStyles'];
      } catch {
        return undefined;
      }
    })();
    const border = normalizeTextBorder(
      (textObj as Textbox & { data?: { border?: unknown } }).data?.border,
    );
    const lineHeight =
      typeof textObj.lineHeight === 'number' && textObj.lineHeight > 0
        ? textObj.lineHeight
        : undefined;
    const charSpacing =
      typeof textObj.charSpacing === 'number' ? textObj.charSpacing : undefined;
    return {
      ...base,
      width: (textObj.width ?? 0) * (textObj.scaleX ?? 1),
      height: (textObj.height ?? 0) * (textObj.scaleY ?? 1),
      type: 'text',
      content: textObj.text ?? '',
      style: {
        fontFamily: textObj.fontFamily ?? 'Arial',
        fontSize: textObj.fontSize ?? 16,
        color: toHexColor(textObj.fill, '#000000'),
        align: (textObj.textAlign as 'left' | 'center' | 'right') ?? 'left',
        fontWeight: textObj.fontWeight as string | undefined,
        fontStyle: (textObj.fontStyle as string | undefined) || undefined,
        opacity: textObj.opacity,
        ...(lineHeight != null ? { lineHeight } : {}),
        ...(charSpacing != null && charSpacing !== 0 ? { charSpacing } : {}),
        ...(border && textBorderIsVisible(border) ? { border } : {}),
      },
      ...(charStyles ? { charStyles } : {}),
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

  const { width, height } = getCanvasLogicalSize(canvas);

  let background: MenuPage['background'] = { type: 'color', value: '#FFFFFF' };
  const bgImage = canvas.backgroundImage;
  if (bgImage && typeof bgImage === 'object') {
    const src =
      (bgImage as FabricImage & { data?: { src?: string } }).data?.src ||
      (typeof (bgImage as FabricImage).getSrc === 'function'
        ? (bgImage as FabricImage).getSrc()
        : '') ||
      '';
    if (src) {
      background = { type: 'image', value: src };
    }
  }
  if (background.type !== 'image') {
    const bg = canvas.backgroundColor;
    background =
      typeof bg === 'string'
        ? { type: 'color', value: bg }
        : { type: 'color', value: '#FFFFFF' };
  }

  return {
    id: pageId,
    background,
    layers,
    width,
    height,
  };
}

/** Documento de una sola página (compat / utilidades) */
export function canvasToCanvasData(canvas: Canvas, pageId = 'page_1'): CanvasData {
  const page = canvasToPageData(canvas, pageId);
  return {
    width: page.width ?? A4_WIDTH,
    height: page.height ?? A4_HEIGHT,
    pages: [page],
  };
}

export function createTextLayer(x = 80, y = 120): TextLayer {
  return {
    id: `layer_${crypto.randomUUID().slice(0, 8)}`,
    type: 'text',
    content: 'Nuevo texto',
    x,
    y,
    width: 400,
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
 * Ajusta una imagen al tamaño lógico del lienzo.
 * - cover: llena todo (recorta si hace falta)
 * - contain: cabe entera sin recortar
 */
export function fitImageToA4(
  img: FabricImage,
  canvas: Canvas,
  mode: 'cover' | 'contain' = 'cover',
): void {
  const { width: cw, height: ch } = getCanvasLogicalSize(canvas);
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

/**
 * Zoom de vista del editor: mismo mecanismo que fitCanvasToContainer
 * (setZoom + setDimensions; no CSS transform: scale).
 */
export function applyCanvasZoom(
  canvas: Canvas,
  zoomPercent: number,
  pageWidth?: number,
  pageHeight?: number,
): void {
  const el =
    typeof canvas.getElement === 'function'
      ? canvas.getElement()
      : (
          canvas as Canvas & {
            elements?: { lower?: { el?: HTMLCanvasElement } };
            lower?: { el?: HTMLCanvasElement };
          }
        ).elements?.lower?.el ??
        (canvas as Canvas & { lower?: { el?: HTMLCanvasElement } }).lower?.el;
  if (!el) return;

  const logical = getCanvasLogicalSize(canvas);
  const width = pageWidth && pageWidth > 0 ? pageWidth : logical.width;
  const height = pageHeight && pageHeight > 0 ? pageHeight : logical.height;
  setCanvasLogicalSize(canvas, width, height);

  const zoom = Math.max(0.25, Math.min(2, zoomPercent / 100));
  canvas.setZoom(zoom);
  canvas.setDimensions({
    width: width * zoom,
    height: height * zoom,
  });
  canvas.calcOffset();
  canvas.requestRenderAll();
}

export function ensureA4Canvas(canvas: Canvas): void {
  const zoomPercent = Math.round((canvas.getZoom() || 1) * 100);
  const { width, height } = getCanvasLogicalSize(canvas);
  applyCanvasZoom(canvas, zoomPercent, width, height);
}

/** Redimensiona el lienzo lógico y aplica el zoom actual. */
export function resizeCanvasPage(
  canvas: Canvas,
  width: number,
  height: number,
  zoomPercent?: number,
): void {
  const zoom =
    zoomPercent ?? Math.round((canvas.getZoom() || 1) * 100);
  applyCanvasZoom(canvas, zoom, width, height);
}
