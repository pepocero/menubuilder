import { ensureEditorFontLoaded } from '@/lib/google-fonts';
import type { MenuPage } from '@/types/canvas';

/** Extrae familias tipográficas usadas en una página del menú. */
export function extractFontFamiliesFromPage(page: MenuPage): string[] {
  const fonts = new Set<string>();
  for (const layer of page.layers) {
    if (layer.type === 'menuLine') {
      const normalizedRows =
        Array.isArray(layer.rows) && layer.rows.length > 0
          ? layer.rows
          : layer.columns
            ? [layer.columns]
            : [];
      for (const row of normalizedRows) {
        for (const col of Object.values(row)) {
          if (col && typeof col === 'object' && 'style' in col && col.style?.fontFamily) {
            fonts.add(col.style.fontFamily);
          }
        }
      }
      continue;
    }
    if (layer.type !== 'text') continue;
    if (layer.style.fontFamily) fonts.add(layer.style.fontFamily);
    if (!layer.charStyles) continue;
    for (const line of Object.values(layer.charStyles)) {
      for (const style of Object.values(line)) {
        if (typeof style.fontFamily === 'string' && style.fontFamily) {
          fonts.add(style.fontFamily);
        }
      }
    }
  }
  return [...fonts];
}

/**
 * Carga las fuentes del diseño y espera a que estén listas
 * ANTES de medir/renderizar texto en Fabric.
 */
export async function ensureFontsLoaded(fontFamilies: string[]): Promise<void> {
  const unique = [...new Set(fontFamilies.filter(Boolean))];
  for (const family of unique) {
    try {
      ensureEditorFontLoaded(family);
    } catch {
      /* opcional */
    }
  }

  if (typeof document === 'undefined' || !document.fonts?.load) return;

  await Promise.all(
    unique.map(async (family) => {
      const quoted = family.includes(' ') ? `"${family}"` : family;
      try {
        await Promise.all([
          document.fonts.load(`16px ${quoted}`),
          document.fonts.load(`400 16px ${quoted}`),
          document.fonts.load(`700 16px ${quoted}`),
          document.fonts.load(`italic 400 16px ${quoted}`),
        ]);
      } catch {
        /* ignore */
      }
    }),
  );

  try {
    await document.fonts.ready;
  } catch {
    /* ignore */
  }
}
