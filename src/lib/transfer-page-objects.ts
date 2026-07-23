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
 */
export function detectPageSpill(
  canvas: Canvas,
  target: FabricObject | undefined | null,
): PageSpillDirection | null {
  if (!target) return null;
  const { height } = getCanvasLogicalSize(canvas);
  if (height <= 0) return null;

  const top = target.top ?? 0;
  const h = getObjectHeight(target);
  const bottom = top + h;

  // ≥50 % por debajo del borde inferior
  if (top + h * 0.5 > height) return 'next';
  // ≥50 % por encima del borde superior
  if (bottom - h * 0.5 < 0) return 'prev';
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

  // Si el puntero está claramente por debajo/arriba de la página origen,
  // elegir la página adyacente más cercana.
  const fromRect = blocks[fromIndex].getBoundingClientRect();
  if (clientY > fromRect.bottom + 8 && fromIndex + 1 < blocks.length) {
    return fromIndex + 1;
  }
  if (clientY < fromRect.top - 8 && fromIndex > 0) {
    return fromIndex - 1;
  }
  return null;
}

function collectTransferObjects(fromCanvas: Canvas): FabricObject[] {
  const active = fromCanvas.getActiveObject();
  if (active instanceof ActiveSelection) {
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

/** Si el objeto quedó fuera del lienzo al arrastrar, lo devuelve dentro. */
export function clampActiveObjectsIntoPage(canvas: Canvas): boolean {
  const { width, height } = getCanvasLogicalSize(canvas);
  const objects =
    canvas.getActiveObjects().length > 0
      ? canvas.getActiveObjects()
      : canvas.getActiveObject()
        ? [canvas.getActiveObject()!]
        : [];
  if (objects.length === 0) return false;

  let changed = false;
  for (const obj of objects) {
    const h = getObjectHeight(obj);
    const w = getObjectWidth(obj);
    const left = obj.left ?? 0;
    const top = obj.top ?? 0;
    const nextLeft = Math.max(-w * 0.25, Math.min(left, width - w * 0.25));
    const nextTop = Math.max(0, Math.min(top, Math.max(height - h, 0)));
    if (nextLeft !== left || nextTop !== top) {
      obj.set({ left: nextLeft, top: nextTop });
      obj.setCoords();
      changed = true;
    }
  }
  if (changed) canvas.requestRenderAll();
  return changed;
}
