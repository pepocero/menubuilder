import { Canvas, Textbox, type FabricObject } from 'fabric';
import { isTextObject, refreshTextboxLayout } from '@/lib/canvas-serializer';
import { setLayerObjectData } from '@/lib/layer-utils';
import { applyTextStyleProps } from '@/lib/text-char-styles';

function asTextbox(obj: FabricObject): Textbox {
  return obj as Textbox;
}

/** Capas de texto incluidas en la selección activa del lienzo. */
export function getSelectedTextObjects(canvas: Canvas | null): Textbox[] {
  if (!canvas) return [];
  return canvas.getActiveObjects().filter(isTextObject).map(asTextbox);
}

export function canMergeSelectedTextLayers(canvas: Canvas | null): boolean {
  if (!canvas) return false;
  return getSelectedTextObjects(canvas).length >= 2;
}

/** Aplica fuente/tamaño/etc. a todas las capas de texto seleccionadas. */
export function applyStyleToSelectedTextLayers(
  canvas: Canvas | null,
  props: Record<string, unknown>,
): number {
  if (!canvas) return 0;
  const texts = getSelectedTextObjects(canvas);
  if (texts.length === 0) return 0;

  for (const text of texts) {
    applyTextStyleProps(text, props);
  }
  canvas.requestRenderAll();
  return texts.length;
}

/** Valores comunes de estilo entre las capas seleccionadas (null = distinto). */
export function getSharedSelectedTextStyle(canvas: Canvas | null): {
  fontFamily: string | null;
  fontSize: number | null;
} {
  const texts = getSelectedTextObjects(canvas);
  if (texts.length === 0) return { fontFamily: null, fontSize: null };

  const firstFamily = String(texts[0].fontFamily ?? 'Arial');
  const firstSize = Math.round(Number(texts[0].fontSize) || 16);
  const sameFamily = texts.every((t) => String(t.fontFamily ?? 'Arial') === firstFamily);
  const sameSize = texts.every((t) => Math.round(Number(t.fontSize) || 16) === firstSize);

  return {
    fontFamily: sameFamily ? firstFamily : null,
    fontSize: sameSize ? firstSize : null,
  };
}

/**
 * Une las capas de texto seleccionadas en una sola, de arriba hacia abajo
 * (y de izquierda a derecha si comparten la misma altura).
 * Devuelve el Textbox resultante o null si no hay al menos 2 textos.
 */
export function mergeSelectedTextLayers(canvas: Canvas): Textbox | null {
  const texts = getSelectedTextObjects(canvas);
  if (texts.length < 2) return null;

  const sorted = [...texts].sort((a, b) => {
    const ra = a.getBoundingRect();
    const rb = b.getBoundingRect();
    if (Math.abs(ra.top - rb.top) > 2) return ra.top - rb.top;
    return ra.left - rb.left;
  });

  const content = sorted.map((t) => t.text ?? '').join('\n');
  const first = sorted[0];
  const bounds = sorted.map((t) => t.getBoundingRect());
  const left = Math.min(...bounds.map((b) => b.left));
  const top = Math.min(...bounds.map((b) => b.top));
  const width = Math.max(
    48,
    ...sorted.map((t) => (Number(t.width) || 0) * (t.scaleX ?? 1)),
    ...bounds.map((b) => b.width),
  );

  const fillRaw = first.fill;
  const fill =
    typeof fillRaw === 'string' &&
    fillRaw !== '' &&
    fillRaw !== 'transparent' &&
    fillRaw !== 'rgba(0,0,0,0)'
      ? fillRaw
      : '#333333';

  // Soltar la ActiveSelection antes de eliminar hijos.
  canvas.discardActiveObject();

  for (const t of texts) {
    canvas.remove(t);
  }

  const merged = new Textbox(content, {
    originX: 'left',
    originY: 'top',
    left,
    top,
    width: Math.min(width, 595 - 24),
    fontFamily: first.fontFamily || 'Arial',
    fontSize: Math.max(8, Number(first.fontSize) || 22),
    fill,
    textAlign: first.textAlign || 'left',
    fontWeight: first.fontWeight || 'normal',
    fontStyle:
      first.fontStyle === 'italic' || first.fontStyle === 'oblique'
        ? first.fontStyle
        : 'normal',
    opacity: first.opacity ?? 1,
    angle: 0,
  });

  setLayerObjectData(merged, {
    layerId: `layer_${crypto.randomUUID().slice(0, 8)}`,
    layerType: 'text',
  });

  refreshTextboxLayout(merged);
  canvas.add(merged);
  canvas.setActiveObject(merged);
  canvas.requestRenderAll();
  return merged;
}
