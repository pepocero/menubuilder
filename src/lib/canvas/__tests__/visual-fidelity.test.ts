/**
 * Regresión visual ligera: dos renders del mismo diseño deben producir
 * el mismo PNG (hash). Requiere DOM/canvas (happy-dom + fabric).
 *
 * Para pixel-diff contra captura del editor en CI (Puppeteer/Playwright),
 * guardar un golden en `src/lib/canvas/__tests__/fixtures/` y comparar
 * con pixelmatch; este test cubre la paridad de la ruta compartida.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { MenuPage } from '@/types/canvas';
import {
  designCanvasToDataUrl,
  disposeDesignCanvas,
  renderDesign,
} from '@/lib/canvas/render-design';

const samplePage: MenuPage = {
  id: 'page_visual_1',
  width: 400,
  height: 600,
  background: { type: 'color', value: '#FAF6F0' },
  layers: [
    {
      id: 't1',
      type: 'text',
      content: 'TAPES\nBraves          6,00\nNachos          8,00',
      x: 40,
      y: 60,
      width: 320,
      height: 20,
      zIndex: 1,
      style: {
        fontFamily: 'Arial',
        fontSize: 18,
        color: '#222222',
        align: 'left',
        lineHeight: 1.16,
      },
    },
  ],
};

function hashDataUrl(dataUrl: string): string {
  return createHash('sha256').update(dataUrl).digest('hex');
}

describe('regresión visual renderDesign', () => {
  it('dos renders idénticos producen el mismo hash PNG', async () => {
    const el1 = document.createElement('canvas');
    const el2 = document.createElement('canvas');
    document.body.appendChild(el1);
    document.body.appendChild(el2);

    let c1 = null as Awaited<ReturnType<typeof renderDesign>> | null;
    let c2 = null as Awaited<ReturnType<typeof renderDesign>> | null;
    try {
      c1 = await renderDesign(el1, samplePage, {
        mode: 'static',
        enableRetinaScaling: false,
      });
      c2 = await renderDesign(el2, samplePage, {
        mode: 'static',
        enableRetinaScaling: false,
      });

      const png1 = designCanvasToDataUrl(c1, 1);
      const png2 = designCanvasToDataUrl(c2, 1);
      expect(png1).toBeTruthy();
      expect(png2).toBeTruthy();
      expect(hashDataUrl(png1!)).toBe(hashDataUrl(png2!));
    } finally {
      disposeDesignCanvas(c1);
      disposeDesignCanvas(c2);
      el1.remove();
      el2.remove();
    }
  }, 20_000);
});
