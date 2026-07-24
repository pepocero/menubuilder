import type { MenuPage } from '@/types/canvas';
import {
  designCanvasToDataUrl,
  disposeDesignCanvas,
  renderDesign,
} from '@/lib/canvas/render-design';

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
