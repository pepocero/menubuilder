import { describe, expect, it } from 'vitest';
import { looksLikeSectionSubtitle, looksLikeSectionTitle } from '@/lib/text-to-menu-line';
import {
  menuOcrResultToMobileComponents,
  resolveSectionTitleSubtitleBody,
} from '@/lib/ocr-to-mobile-menu';
import type { MenuOcrResult } from '@shared/menu-ocr';

describe('looksLikeSectionSubtitle', () => {
  it('detecta frases bajo un título de categoría', () => {
    expect(looksLikeSectionSubtitle('Para compartir')).toBe(true);
    expect(looksLikeSectionSubtitle('Nuestros clásicos de la casa')).toBe(true);
  });

  it('no confunde títulos en mayúsculas ni listas de ingredientes', () => {
    expect(looksLikeSectionTitle('ENTRANTES')).toBe(true);
    expect(looksLikeSectionSubtitle('ENTRANTES')).toBe(false);
    expect(
      looksLikeSectionSubtitle('jamón ibérico, bechamel, nuez moscada'),
    ).toBe(false);
  });
});

describe('resolveSectionTitleSubtitleBody', () => {
  it('separa título mayúsculas, subtítulo y platos del body', () => {
    const resolved = resolveSectionTitleSubtitleBody({
      title: '',
      subtitle: '',
      column: 'full',
      order: 1,
      body: [
        'ENTRANTES',
        'Para compartir',
        'Croquetas de jamón',
        'jamón ibérico, bechamel',
        '8,00 €',
      ].join('\n'),
    });
    expect(resolved.title).toBe('ENTRANTES');
    expect(resolved.subtitle).toBe('Para compartir');
    expect(resolved.body).toContain('Croquetas de jamón');
    expect(resolved.body).not.toContain('ENTRANTES');
    expect(resolved.body).not.toContain('Para compartir');
  });

  it('respeta subtitle del OCR y quita duplicados del body', () => {
    const resolved = resolveSectionTitleSubtitleBody({
      title: 'TAPAS',
      subtitle: 'Para picar',
      column: 'full',
      order: 1,
      body: ['TAPAS', 'Para picar', 'Patatas bravas — 6,00 €'].join('\n'),
    });
    expect(resolved.title).toBe('TAPAS');
    expect(resolved.subtitle).toBe('Para picar');
    expect(resolved.body).toBe('Patatas bravas — 6,00 €');
  });
});

describe('menuOcrResultToMobileComponents título/subtítulo', () => {
  it('crea Sección + Texto + Plato en el orden esperado', () => {
    const menu: MenuOcrResult = {
      headerTitle: '',
      headerSubtitle: '',
      sections: [
        {
          title: 'ENTRANTES',
          subtitle: 'Para compartir',
          column: 'full',
          order: 1,
          body: [
            'Croquetas de jamón — 8,00 €',
            'jamón ibérico, bechamel',
          ].join('\n'),
        },
      ],
    };

    const components = menuOcrResultToMobileComponents(menu);
    expect(components.map((c) => c.type)).toEqual(['section', 'text', 'menuItem']);
    expect(components[0]).toMatchObject({ type: 'section', title: 'ENTRANTES' });
    expect(components[1]).toMatchObject({ type: 'text', text: 'Para compartir' });
    expect(components[2]).toMatchObject({
      type: 'menuItem',
      title: 'Croquetas de jamón',
      ingredients: 'jamón ibérico - bechamel',
    });
  });

  it('empareja nombre + ingredientes + precio en líneas separadas', () => {
    const menu: MenuOcrResult = {
      headerTitle: '',
      headerSubtitle: '',
      sections: [
        {
          title: 'TAPAS',
          subtitle: '',
          column: 'full',
          order: 1,
          body: [
            'Croquetas de jamón',
            'jamón ibérico, bechamel',
            '8,00 €',
          ].join('\n'),
        },
      ],
    };

    const components = menuOcrResultToMobileComponents(menu);
    expect(components.map((c) => c.type)).toEqual(['section', 'menuItem']);
    expect(components[1]).toMatchObject({
      type: 'menuItem',
      title: 'Croquetas de jamón',
      ingredients: 'jamón ibérico - bechamel',
    });
  });
});
