import { Canvas } from 'fabric';
import type { CanvasData } from '@/types/canvas';
import { getPageSize } from '@/lib/page-size';
import { loadPageOntoCanvas } from '@/lib/canvas-serializer';
import { generateThumbnail } from '@/lib/image-compress';

/**
 * Renderiza la primera página del documento a una miniatura PNG (data URL)
 * para la tarjeta de «Mis menús».
 */
export async function renderCanvasDataThumbnail(
  data: CanvasData,
  maxWidth = 400,
): Promise<string | null> {
  const page = data.pages?.[0];
  if (!page) return null;

  const size = getPageSize(page);
  const el = document.createElement('canvas');
  el.width = size.width;
  el.height = size.height;
  el.style.cssText = 'position:fixed;left:-99999px;top:0;pointer-events:none;';
  document.body.appendChild(el);

  const canvas = new Canvas(el, {
    width: size.width,
    height: size.height,
    enableRetinaScaling: false,
    renderOnAddRemove: false,
    backgroundColor:
      page.background.type === 'color' ? page.background.value : '#ffffff',
  });

  try {
    await loadPageOntoCanvas(canvas, page, size.width, size.height);
    canvas.requestRenderAll();
    const png = canvas.toDataURL({ format: 'png', multiplier: 1 });
    if (!png || png.length < 32) return null;
    return await generateThumbnail(png, maxWidth);
  } catch {
    return null;
  } finally {
    try {
      canvas.dispose();
    } catch {
      /* ignore */
    }
    el.remove();
  }
}

/** Añade el sufijo «(Importado)» si aún no está. */
export function withImportedMenuTitle(title: string): string {
  const base = title.trim() || 'Menú';
  if (/\(\s*importado\s*\)/i.test(base)) return base;
  return `${base} (Importado)`;
}
