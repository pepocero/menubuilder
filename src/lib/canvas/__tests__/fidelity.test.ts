import { describe, expect, it } from 'vitest';
import { Textbox } from 'fabric';
import { layerToFabricObject, fabricObjectToLayer } from '@/lib/canvas-serializer';
import type { TextLayer } from '@/types/canvas';
import { CUSTOM_TEXT_PROPS, DEFAULT_TEXT_LINE_HEIGHT } from '@/lib/canvas/text-props';
import { extractFontFamiliesFromPage } from '@/lib/canvas/fonts';
import type { MenuPage } from '@/types/canvas';

function sampleTextLayer(overrides?: Partial<TextLayer>): TextLayer {
  return {
    id: 'layer_text_1',
    type: 'text',
    content: 'Braves          6,00\nBunyols         8,00',
    x: 40,
    y: 80,
    width: 320,
    height: 40,
    zIndex: 1,
    style: {
      fontFamily: 'Poppins',
      fontSize: 18,
      color: '#222222',
      align: 'left',
      fontWeight: '400',
      lineHeight: 1.16,
      charSpacing: 0,
    },
    ...overrides,
  };
}

describe('fidelidad texto Fabric ↔ JSON', () => {
  it('CUSTOM_TEXT_PROPS incluye las claves críticas', () => {
    for (const key of [
      'lineHeight',
      'charSpacing',
      'textAlign',
      'fontWeight',
      'fontStyle',
      'fontFamily',
      'fontSize',
      'styles',
    ]) {
      expect(CUSTOM_TEXT_PROPS).toContain(key);
    }
  });

  it('roundtrip TextLayer conserva tipografía y métricas', () => {
    const layer = sampleTextLayer({
      style: {
        fontFamily: 'Playfair Display',
        fontSize: 22,
        color: '#111111',
        align: 'left',
        fontWeight: '700',
        fontStyle: 'italic',
        lineHeight: 1.3,
        charSpacing: 40,
      },
    });

    const obj = layerToFabricObject(layer);
    expect(obj).toBeTruthy();
    expect(obj).toBeInstanceOf(Textbox);

    const text = obj as Textbox;
    expect(text.fontFamily).toBe('Playfair Display');
    expect(text.fontSize).toBe(22);
    expect(text.fontWeight).toBe('700');
    expect(text.fontStyle).toBe('italic');
    expect(text.lineHeight).toBe(1.3);
    expect(text.charSpacing).toBe(40);
    expect(text.width).toBe(320);

    const back = fabricObjectToLayer(text, 1) as TextLayer;
    expect(back.type).toBe('text');
    expect(back.style.fontFamily).toBe('Playfair Display');
    expect(back.style.fontSize).toBe(22);
    expect(back.style.fontWeight).toBe('700');
    expect(back.style.fontStyle).toBe('italic');
    expect(back.style.lineHeight).toBe(1.3);
    expect(back.style.charSpacing).toBe(40);
    expect(back.content).toBe(layer.content);
  });

  it('el alto del Textbox se recalcula (no queda anclado al height guardado corto)', () => {
    const layer = sampleTextLayer({
      height: 10,
      content: 'Línea 1\nLínea 2\nLínea 3\nLínea 4\nLínea 5',
      style: {
        fontFamily: 'Arial',
        fontSize: 20,
        color: '#000',
        align: 'left',
        lineHeight: DEFAULT_TEXT_LINE_HEIGHT,
      },
    });

    const obj = layerToFabricObject(layer) as Textbox;
    obj.initDimensions();
    const computedHeight = obj.height ?? 0;
    expect(computedHeight).toBeGreaterThan(layer.height);

    const back = fabricObjectToLayer(obj, 1) as TextLayer;
    expect(back.height).toBeGreaterThan(layer.height);
    expect(Math.abs(back.height - computedHeight)).toBeLessThan(1);
  });

  it('extractFontFamiliesFromPage recoge familias de capa y charStyles', () => {
    const page: MenuPage = {
      id: 'page_1',
      background: { type: 'color', value: '#fff' },
      layers: [
        sampleTextLayer(),
        sampleTextLayer({
          id: 't2',
          style: {
            fontFamily: 'Merriweather',
            fontSize: 14,
            color: '#000',
            align: 'left',
          },
          charStyles: {
            '0': {
              '0': { fontFamily: 'Oswald' },
            },
          },
        }),
      ],
    };

    const fonts = extractFontFamiliesFromPage(page);
    expect(fonts).toEqual(expect.arrayContaining(['Poppins', 'Merriweather', 'Oswald']));
  });
});
