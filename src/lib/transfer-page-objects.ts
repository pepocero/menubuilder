import { ActiveSelection, type Canvas, type FabricObject } from 'fabric';
import type { CanvasLayer } from '@/types/canvas';
import {
  addLayerToCanvas,
  fabricObjectToLayer,
  getCanvasLogicalSize,
} from '@/lib/canvas-serializer';

export type PageSpillDirection = 'prev' | 'next';

/** Evita transferencias solapadas (origen de copias en bucle). */
let transferInFlight = false;

export function isPageTransferInFlight(): boolean {
  return transferInFlight;
}

/**
 * Detección robusta de selección múltiple.
 * No usar solo `instanceof`: con Vite/Fabric puede fallar por duplicado de módulo
 * y entonces se tratan left/top relativos de los hijos como absolutos → esquina.
 */
export function isCanvasActiveSelection(
  obj: FabricObject | null | undefined,
): obj is ActiveSelection {
  if (!obj) return false;
  if (obj instanceof ActiveSelection) return true;
  if (obj.type === 'activeSelection' || obj.type === 'ActiveSelection') return true;
  return 'multiSelectionStacking' in obj;
}

function getObjectHeight(obj: FabricObject): number {
  if (typeof obj.getScaledHeight === 'function') {
    const h = obj.getScaledHeight();
    if (Number.isFinite(h) && h > 0) return h;
  }
  return Math.max((obj.height ?? 0) * (obj.scaleY ?? 1), 1);
}

function getObjectWidth(obj: FabricObject): number {
  if (typeof obj.getScaledWidth === 'function') {
    const w = obj.getScaledWidth();
    if (Number.isFinite(w) && w > 0) return w;
  }
  return Math.max((obj.width ?? 0) * (obj.scaleX ?? 1), 1);
}

/**
 * ¿La mayor parte del objeto ya cruzó el borde superior/inferior?
 * Usa bounds de escena (respeta origin center/left).
 * Umbral alto: solo si casi ha salido del todo (≥85 %).
 */
export function detectPageSpill(
  canvas: Canvas,
  target: FabricObject | undefined | null,
): PageSpillDirection | null {
  if (!target) return null;
  const { height } = getCanvasLogicalSize(canvas);
  if (height <= 0) return null;

  const bounds = getObjectSceneBounds(target);
  const visibleTop = Math.max(bounds.top, 0);
  const visibleBottom = Math.min(bounds.top + bounds.height, height);
  const visible = Math.max(0, visibleBottom - visibleTop);
  const ratio = visible / Math.max(1, bounds.height);

  // Casi fuera por abajo → página siguiente
  if (bounds.top + bounds.height * 0.15 > height && ratio < 0.15) return 'next';
  // Casi fuera por arriba → página anterior
  if (bounds.top + bounds.height * 0.85 < 0 && ratio < 0.15) return 'prev';
  return null;
}

/**
 * Página bajo el puntero al soltar (distinta de la origen).
 */
export function resolveDropPageIndex(
  clientX: number,
  clientY: number,
  fromIndex: number,
): number | null {
  const blocks = Array.from(document.querySelectorAll('.page-block'));
  if (blocks.length < 2 || fromIndex < 0 || fromIndex >= blocks.length) {
    return null;
  }

  for (let i = 0; i < blocks.length; i++) {
    const r = blocks[i].getBoundingClientRect();
    if (
      clientY >= r.top &&
      clientY <= r.bottom &&
      clientX >= r.left - 48 &&
      clientX <= r.right + 48
    ) {
      return i === fromIndex ? null : i;
    }
  }

  // Si el puntero está claramente en el hueco entre páginas (no sobre ninguna),
  // solo entonces elegir la adyacente — margen amplio para no saltar al rozar el borde.
  const fromRect = blocks[fromIndex].getBoundingClientRect();
  const gap = 40;
  if (clientY > fromRect.bottom + gap && fromIndex + 1 < blocks.length) {
    return fromIndex + 1;
  }
  if (clientY < fromRect.top - gap && fromIndex > 0) {
    return fromIndex - 1;
  }
  return null;
}

function collectTransferObjects(fromCanvas: Canvas): FabricObject[] {
  const active = fromCanvas.getActiveObject();
  if (isCanvasActiveSelection(active)) {
    const members = [...active.getObjects()];
    fromCanvas.discardActiveObject();
    return members.filter((o) => fromCanvas.getObjects().includes(o));
  }
  if (active) return [active];
  return [...fromCanvas.getActiveObjects()];
}

function clampLayerToPage(
  layer: CanvasLayer,
  pageWidth: number,
  pageHeight: number,
): CanvasLayer {
  const w = Math.max(layer.width || 0, 8);
  const h = Math.max(layer.height || 0, 8);
  return {
    ...layer,
    x: Math.max(-w * 0.25, Math.min(layer.x, pageWidth - w * 0.25)),
    y: Math.max(0, Math.min(layer.y, Math.max(pageHeight - h, 0))),
  };
}

/** Mantiene una capa dentro de los límites lógicos de la página. */
export function clampLayerIntoPage(
  layer: CanvasLayer,
  pageWidth: number,
  pageHeight: number,
): CanvasLayer {
  return clampLayerToPage(layer, pageWidth, pageHeight);
}

/**
 * Mueve la selección activa de un lienzo a otro (una sola vez; con candado).
 */
export async function transferObjectsBetweenPages(options: {
  fromCanvas: Canvas;
  toCanvas: Canvas;
  direction: PageSpillDirection;
  fromSpill?: boolean;
}): Promise<FabricObject[]> {
  if (transferInFlight) return [];
  if (options.fromCanvas === options.toCanvas) return [];

  transferInFlight = true;
  try {
    const { fromCanvas, toCanvas, direction, fromSpill = false } = options;
    const fromSize = getCanvasLogicalSize(fromCanvas);
    const toSize = getCanvasLogicalSize(toCanvas);

    const objects = collectTransferObjects(fromCanvas);
    if (objects.length === 0) return [];

    const layers: CanvasLayer[] = [];
    for (let i = 0; i < objects.length; i++) {
      const layer = fabricObjectToLayer(objects[i], i + 1);
      if (!layer) continue;

      // Nuevo id en destino: evita colisiones si quedan restos o copias.
      layer.id = `layer_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;

      if (fromSpill) {
        layer.y =
          direction === 'next'
            ? layer.y - fromSize.height
            : layer.y + toSize.height;
      }

      layers.push(clampLayerToPage(layer, toSize.width, toSize.height));
    }

    if (layers.length === 0) return [];

    // Quitar primero del origen (evita copias si algo falla a mitad).
    fromCanvas.discardActiveObject();
    fromCanvas.remove(...objects);
    fromCanvas.requestRenderAll();

    const added: FabricObject[] = [];
    for (const layer of layers) {
      await addLayerToCanvas(toCanvas, layer);
      const sel = toCanvas.getActiveObject();
      if (sel && !added.includes(sel)) added.push(sel);
    }

    if (added.length > 1) {
      toCanvas.setActiveObject(new ActiveSelection(added, { canvas: toCanvas }));
    } else if (added.length === 1) {
      toCanvas.setActiveObject(added[0]);
    }
    toCanvas.requestRenderAll();
    return added;
  } finally {
    transferInFlight = false;
  }
}

/**
 * Rectángulo en coordenadas del lienzo (sin zoom de viewport).
 * Evita getBoundingRect() que incluye el transform del canvas.
 */
function getObjectSceneBounds(obj: FabricObject): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const w = getObjectWidth(obj);
  const h = getObjectHeight(obj);
  const left = obj.left ?? 0;
  const top = obj.top ?? 0;
  const originX = obj.originX ?? 'left';
  const originY = obj.originY ?? 'top';
  const ox =
    originX === 'center' ? left - w / 2 : originX === 'right' ? left - w : left;
  const oy =
    originY === 'center' ? top - h / 2 : originY === 'bottom' ? top - h : top;
  return { left: ox, top: oy, width: w, height: h };
}

/** Parte mínima que debe seguir viéndose en la página (permite colgar fuera). */
const MIN_VISIBLE_RATIO = 0.2;
const MIN_VISIBLE_PX = 24;

function softClampAxis(size: number, pageSize: number): { min: number; max: number } {
  const keep = Math.max(
    MIN_VISIBLE_PX,
    Math.min(size, Math.round(size * MIN_VISIBLE_RATIO)),
  );
  return {
    min: keep - size,
    max: pageSize - keep,
  };
}

function applySoftClampDelta(
  obj: FabricObject,
  pageWidth: number,
  pageHeight: number,
): boolean {
  const bounds = getObjectSceneBounds(obj);
  const xRange = softClampAxis(bounds.width, pageWidth);
  const yRange = softClampAxis(bounds.height, pageHeight);
  let dx = 0;
  let dy = 0;
  if (bounds.left < xRange.min) dx = xRange.min - bounds.left;
  else if (bounds.left > xRange.max) dx = xRange.max - bounds.left;
  if (bounds.top < yRange.min) dy = yRange.min - bounds.top;
  else if (bounds.top > yRange.max) dy = yRange.max - bounds.top;
  if (dx === 0 && dy === 0) return false;
  obj.set({
    left: (obj.left ?? 0) + dx,
    top: (obj.top ?? 0) + dy,
  });
  obj.setCoords();
  return true;
}

/**
 * Evita que la capa se pierda del todo fuera del lienzo.
 * Permite colgar parte fuera (p. ej. imagen a caballo del borde).
 */
export function clampActiveObjectsIntoPage(canvas: Canvas): boolean {
  const { width, height } = getCanvasLogicalSize(canvas);
  const active = canvas.getActiveObject();
  if (!active) return false;

  // En ActiveSelection los hijos tienen coords relativas al grupo:
  // clampear la selección entera.
  if (isCanvasActiveSelection(active)) {
    const changed = applySoftClampDelta(active, width, height);
    if (changed) canvas.requestRenderAll();
    return changed;
  }

  const objects =
    canvas.getActiveObjects().length > 0 ? canvas.getActiveObjects() : [active];

  let changed = false;
  for (const obj of objects) {
    if (applySoftClampDelta(obj, width, height)) changed = true;
  }
  if (changed) canvas.requestRenderAll();
  return changed;
}
