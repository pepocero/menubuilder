import type { CanvasData } from '@/types/canvas';
import { generateThumbnail } from '@/lib/image-compress';
import { renderMenuPageToDataUrl } from '@/lib/render-menu-page';

/**
 * Renderiza la primera página del documento a una miniatura PNG (data URL)
 * para la tarjeta de «Mis menús» — misma ruta `renderDesign` que la carta pública.
 */
export async function renderCanvasDataThumbnail(
  data: CanvasData,
  maxWidth = 400,
): Promise<string | null> {
  const page = data.pages?.[0];
  if (!page) return null;

  try {
    const png = await renderMenuPageToDataUrl(page, { multiplier: 1 });
    if (!png) return null;
    return await generateThumbnail(png, maxWidth);
  } catch {
    return null;
  }
}

/** Añade el sufijo «(Importado)» si aún no está. */
export function withImportedMenuTitle(title: string): string {
  const base = title.trim() || 'Menú';
  if (/\(\s*importado\s*\)/i.test(base)) return base;
  return `${base} (Importado)`;
}
