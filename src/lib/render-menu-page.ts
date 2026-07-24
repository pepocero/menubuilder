import type { MenuPage } from '@/types/canvas';
import {
  designCanvasToDataUrl,
  disposeDesignCanvas,
  renderDesign,
} from '@/lib/canvas/render-design';

/** Piso: nítido en móvil típico. Techo: evita PNG enormes en monitores 4K. */
export const PUBLIC_RENDER_MULTIPLIER_MIN = 2;
export const PUBLIC_RENDER_MULTIPLIER_MAX = 4;

/**
 * Multiplier de export PNG según tamaño en pantalla.
 * `ceil((anchoVisibleCss * dpr) / anchoDiseño)`, acotado a [2, 4].
 */
export function computePublicRenderMultiplier(
  designWidth: number,
  displayWidthCss: number,
  devicePixelRatio: number = typeof window !== 'undefined'
    ? window.devicePixelRatio || 1
    : 1,
): number {
  const min = PUBLIC_RENDER_MULTIPLIER_MIN;
  const max = PUBLIC_RENDER_MULTIPLIER_MAX;
  if (
    !Number.isFinite(designWidth) ||
    designWidth <= 0 ||
    !Number.isFinite(displayWidthCss) ||
    displayWidthCss <= 0
  ) {
    return min;
  }
  const dpr =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1;
  const needed = (displayWidthCss * dpr) / designWidth;
  return Math.min(max, Math.max(min, Math.ceil(needed)));
}

/**
 * Renderiza una página con la función compartida `renderDesign` (StaticCanvas)
 * y devuelve PNG. Misma ruta de fuentes/carga que el editor.
 */
export async function renderMenuPageToDataUrl(
  page: MenuPage,
  options?: { multiplier?: number },
): Promise<string | null> {
  const el = document.createElement('canvas');
  el.style.cssText = 'position:fixed;left:-99999px;top:0;pointer-events:none;opacity:0;';
  document.body.appendChild(el);

  let canvas = null as Awaited<ReturnType<typeof renderDesign>> | null;
  try {
    canvas = await renderDesign(el, page, {
      mode: 'static',
      enableRetinaScaling: false,
    });
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    canvas.requestRenderAll();
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));

    return designCanvasToDataUrl(canvas, options?.multiplier ?? 2);
  } catch (err) {
    console.error('No se pudo renderizar la página pública', err);
    return null;
  } finally {
    disposeDesignCanvas(canvas);
    el.remove();
  }
}

export function pageLetterboxColor(page: MenuPage): string {
  if (page.background.type === 'color' && page.background.value) {
    return page.background.value;
  }
  return '#FAF6F0';
}
