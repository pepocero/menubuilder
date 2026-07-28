import { describe, expect, it } from 'vitest';
import {
  formatIngredientsList,
  looksLikeIngredients,
  parseMenuTextBlocks,
  parseMenuTextLine,
  splitIngredientParts,
} from '@/lib/text-to-menu-line';

describe('parseMenuTextLine precio', () => {
  it('detecta precio con raya tipográfica y limpia el nombre', () => {
    const line = parseMenuTextLine('ARROZ BASMATI — 3,00 €');
    expect(line?.hasPrice).toBe(true);
    expect(line?.left).toBe('ARROZ BASMATI');
    expect(line?.right).toMatch(/3,00/);
  });

  it('no trata «Ingrediente 3» como precio', () => {
    expect(parseMenuTextLine('Ingrediente 1, Ingrediente 2, Ingrediente 3')?.hasPrice).toBe(
      false,
    );
    expect(parseMenuTextLine('Ingrediente 3')?.hasPrice).toBe(false);
    expect(looksLikeIngredients('Ingrediente 1, Ingrediente 2, Ingrediente 3')).toBe(true);
  });
});

describe('caso real OCR samosas/pakoras', () => {
  it('rellena Ingredientes por fila y deja el nombre en Plato', () => {
    const raw = [
      'SAMOSA VEGETAL — 3,00 €',
      'Ingrediente 1, Ingrediente 2, Ingrediente 3',
      'SAMOSA DE CORDERO — 3,00 €',
      'Ingrediente 1, Ingrediente 2, Ingrediente 3',
      'PAKORA DE BERENJENA — 3,00 €',
      'Ingrediente 1, Ingrediente 2, Ingrediente 3',
      'PAKORA DE POLLO — 3,00 €',
      'Ingrediente 1, Ingrediente 2, Ingrediente 3',
    ].join('\n');

    const rows = parseMenuTextBlocks(raw);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.left)).toEqual([
      'SAMOSA VEGETAL',
      'SAMOSA DE CORDERO',
      'PAKORA DE BERENJENA',
      'PAKORA DE POLLO',
    ]);
    for (const row of rows) {
      expect(row.hasPrice).toBe(true);
      expect(row.ingredients).toBe('Ingrediente 1 - Ingrediente 2 - Ingrediente 3');
    }
  });
});

describe('looksLikeIngredients / splitIngredientParts', () => {
  it('detecta ingredientes separados por guiones con espacios', () => {
    const text = 'Mozzarella - Tomàquet - Albérrega';
    expect(looksLikeIngredients(text)).toBe(true);
    expect(splitIngredientParts(text)).toEqual([
      'Mozzarella',
      'Tomàquet',
      'Albérrega',
    ]);
  });

  it('detecta ingredientes separados por comas', () => {
    const text = 'Ingrediente 1, Ingrediente 2, Ingrediente 3';
    expect(looksLikeIngredients(text)).toBe(true);
    expect(splitIngredientParts(text)).toEqual([
      'Ingrediente 1',
      'Ingrediente 2',
      'Ingrediente 3',
    ]);
  });

  it('formatea con el separador de la herramienta', () => {
    expect(formatIngredientsList(['Pollo', 'Nueces', 'Legumbres'])).toBe(
      'Pollo - Nueces - Legumbres',
    );
  });
});

describe('parseMenuTextBlocks → campo Ingredientes (no filas Plato)', () => {
  it('pone ingredientes en row.ingredients, no como filas left', () => {
    const raw = [
      'ARROZ BASMATI — 3,00 €',
      'Pollo,',
      'Nueces,',
      'Legumbres',
    ].join('\n');

    const rows = parseMenuTextBlocks(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0].left).toBe('ARROZ BASMATI');
    expect(rows[0].hasPrice).toBe(true);
    expect(rows[0].ingredients).toBe('Pollo - Nueces - Legumbres');
  });

  it('une ingredientes aunque el OCR meta blancos entre plato e ítems', () => {
    const raw = [
      'ARROZ BASMATI — 3,00 €',
      '',
      'Pollo,',
      '',
      'Nueces,',
      '',
      'Legumbres',
      '',
      'GAMBAS TANDOORI — 4,00 €',
      '',
      'Gamba, Ajo, Perejil',
    ].join('\n');

    const rows = parseMenuTextBlocks(raw);
    expect(rows).toHaveLength(2);
    expect(rows[0].left).toBe('ARROZ BASMATI');
    expect(rows[0].ingredients).toBe('Pollo - Nueces - Legumbres');
    expect(rows[1].left).toMatch(/GAMBAS TANDOORI/i);
    expect(rows[1].ingredients).toBe('Gamba - Ajo - Perejil');
  });

  it('une ítems OCR en líneas sin comas (varios renglones bajo el plato)', () => {
    const raw = [
      'Pollo Tandori .............. 3,00 €',
      'Pollo',
      'Nueces',
      'Legumbres',
    ].join('\n');

    const rows = parseMenuTextBlocks(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0].left).toMatch(/Pollo Tandori/i);
    expect(rows[0].ingredients).toBe('Pollo - Nueces - Legumbres');
  });

  it('empareja plato+precio con ingredientes en una sola línea', () => {
    const raw = [
      'POLLO TANDOORI — 3,00 €',
      'Ingrediente 1, Ingrediente 2, Ingrediente 3',
      '',
      'GAMBAS TANDOORI — 3,00 €',
      'Ingrediente 1, Ingrediente 2, Ingrediente 3',
    ].join('\n');

    const rows = parseMenuTextBlocks(raw);
    expect(rows).toHaveLength(2);
    expect(rows[0].ingredients).toBe('Ingrediente 1 - Ingrediente 2 - Ingrediente 3');
    expect(rows[1].ingredients).toBe('Ingrediente 1 - Ingrediente 2 - Ingrediente 3');
  });

  it('no come un título de sección suelto tras un plato', () => {
    const raw = [
      'Margarida ................................................................ 10,00 €',
      'ENTRANTES',
      '',
      'Croquetas ................................................................ 8,00 €',
    ].join('\n');

    const rows = parseMenuTextBlocks(raw);
    expect(rows).toHaveLength(3);
    expect(rows[0].ingredients).toBeUndefined();
    expect(rows[1].left).toBe('ENTRANTES');
    expect(rows[1].hasPrice).toBe(false);
    expect(rows[2].hasPrice).toBe(true);
  });
});
