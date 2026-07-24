import { Canvas, StaticCanvas, type FabricObject, Textbox } from 'fabric';
import type { MenuPage } from '@/types/canvas';
import { getPageSize } from '@/lib/page-size';
import {
  getCanvasLogicalSize,
  isTextObject,
  loadPageOntoCanvas,
  setCanvasLogicalSize,
} from '@/lib/canvas-serializer';
import { finalizeMenuLineTransform, isMenuLineGroup } from '@/lib/menu-line';
import { ensureFontsLoaded, extractFontFamiliesFromPage } from '@/lib/canvas/fonts';
import { DEFAULT_TEXT_LINE_HEIGHT } from '@/lib/canvas/text-props';

export type DesignCanvas = Canvas | StaticCanvas;

export interface RenderDesignOptions {
  /** Ancho del contenedor CSS; si se indica, aplica fitCanvasToContainer. */
  containerWidth?: number;
  containerHeight?: number;
  /**
   * `interactive`: fabric.Canvas (editor).
   * `static`: fabric.StaticCanvas (vista pública / export).
   */
  mode?: 'interactive' | 'static';
  backgroundColor?: string;
  enableRetinaScaling?: boolean;
}

/**
 * Tras cargar el diseño: ancho fijo, alto recalculado por Fabric
 * (evita cortar texto con un height guardado divergente).
 */
export function recalculateTextboxHeights(canvas: DesignCanvas): void {
  for (const obj of canvas.getObjects()) {
    if (isMenuLineGroup(obj)) {
      finalizeMenuLineTransform(obj);
      continue;
    }
    if (!isTextObject(obj)) continue;
    const text = obj as Textbox;
    const width = Math.max(Number(text.width) || 0, 8);
    if (!text.lineHeight || !Number.isFinite(text.lineHeight)) {
      text.set({ lineHeight: DEFAULT_TEXT_LINE_HEIGHT });
    }
    text.set({ width, dirty: true });
    text.initDimensions();
    text.setCoords();
  }
  canvas.requestRenderAll();
}

/**
 * Escalado consistente editor ↔ público:
 * setZoom + setDimensions (mismo bitmap lógico; no CSS transform: scale).
 * Fabric 7 no expone `cssOnly`; redimensionar el elemento mantiene el zoom.
 */
export function fitCanvasToContainer(
  canvas: DesignCanvas,
  containerWidth: number,
  designWidth?: number,
  designHeight?: number,
  containerHeight?: number,
): number {
  const logical = getCanvasLogicalSize(canvas as Canvas);
  const width =
    designWidth && designWidth > 0 ? designWidth : logical.width;
  const height =
    designHeight && designHeight > 0 ? designHeight : logical.height;
  setCanvasLogicalSize(canvas as Canvas, width, height);

  let scale = containerWidth > 0 ? containerWidth / width : 1;
  if (containerHeight && containerHeight > 0) {
    scale = Math.min(scale, containerHeight / height);
  }
  scale = Math.max(0.05, Math.min(4, scale));

  canvas.setZoom(scale);
  canvas.setDimensions({
    width: width * scale,
    height: height * scale,
  });
  canvas.calcOffset?.();
  canvas.requestRenderAll();
  return scale;
}

/**
 * Única entrada de renderizado para editor y carta pública.
 * 1) Espera fuentes  2) Carga la página (misma ruta que el editor)
 * 3) Recalcula altos de Textbox  4) Escala si hay contenedor
 */
export async function renderDesign(
  canvasEl: HTMLCanvasElement,
  page: MenuPage,
  options: RenderDesignOptions = {},
): Promise<DesignCanvas> {
  const {
    mode = 'static',
    containerWidth,
    containerHeight,
    enableRetinaScaling = mode === 'interactive',
  } = options;

  const size = getPageSize(page);
  const bg =
    options.backgroundColor ??
    (page.background.type === 'color' ? page.background.value : '#FAF6F0');

  const common = {
    width: size.width,
    height: size.height,
    enableRetinaScaling,
    renderOnAddRemove: false as const,
    backgroundColor: bg,
    preserveObjectStacking: true,
  };

  const canvas: DesignCanvas =
    mode === 'interactive'
      ? new Canvas(canvasEl, {
          ...common,
          selection: true,
        })
      : new StaticCanvas(canvasEl, common);

  setCanvasLogicalSize(canvas as Canvas, size.width, size.height);
  await hydrateDesign(canvas as Canvas, page);

  if (containerWidth && containerWidth > 0) {
    fitCanvasToContainer(
      canvas,
      containerWidth,
      size.width,
      size.height,
      containerHeight,
    );
  }

  return canvas;
}

/**
 * Hidrata un Canvas/StaticCanvas ya creado (editor) con la misma ruta
 * que la vista pública: fuentes → loadPageOntoCanvas → recalcular Textbox.
 */
export async function hydrateDesign(
  canvas: Canvas,
  page: MenuPage,
): Promise<void> {
  const size = getPageSize(page);
  await ensureFontsLoaded(extractFontFamiliesFromPage(page));
  await loadPageOntoCanvas(canvas, page, size.width, size.height);
  recalculateTextboxHeights(canvas);
  canvas.requestRenderAll();
}

/** Descarta el canvas de forma segura. */
export function disposeDesignCanvas(canvas: DesignCanvas | null | undefined): void {
  if (!canvas) return;
  try {
    canvas.dispose();
  } catch {
    /* ignore */
  }
}

/** Exporta PNG a resolución de diseño (o con multiplier). */
export function designCanvasToDataUrl(
  canvas: DesignCanvas,
  multiplier = 2,
): string | null {
  try {
    const zoom = canvas.getZoom() || 1;
    // Compensar zoom de vista para exportar a tamaño lógico * multiplier.
    const png = canvas.toDataURL({
      format: 'png',
      multiplier: multiplier / zoom,
      enableRetinaScaling: false,
    });
    return png && png.length >= 32 ? png : null;
  } catch {
    return null;
  }
}

/** Utilidad: objetos de texto del canvas. */
export function getTextObjects(canvas: DesignCanvas): FabricObject[] {
  return canvas.getObjects().filter(isTextObject);
}
