import type { CanvasData } from '@/types/canvas';
import type { MobileComponent, MobileMenuDocument } from '@shared/mobile-menu';
import { generateThumbnail } from '@/lib/image-compress';
import { renderMenuPageToDataUrl } from '@/lib/render-menu-page';
import { normalizeAssetUrl } from '@/lib/asset-url';

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

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.length > 0) {
    const last = lines[maxLines - 1] ?? '';
    lines[maxLines - 1] = last.length > 1 ? `${last.slice(0, Math.max(1, last.length - 1))}…` : '…';
  }
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function isExternalUrl(src: string): boolean {
  if (!/^https?:\/\//i.test(src)) return false;
  try {
    return new URL(src, window.location.origin).origin !== window.location.origin;
  } catch {
    return true;
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = normalizeAssetUrl(src);
    if (!url.trim()) {
      resolve(null);
      return;
    }
    const img = new Image();
    // Solo CORS en URLs externas. En assets propios (/api/...) hace falta la cookie
    // de sesión; con crossOrigin=anonymous la imagen falla y el preview sale vacío.
    if (isExternalUrl(url)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  cover: boolean,
) {
  const scale = cover
    ? Math.max(w / img.naturalWidth, h / img.naturalHeight)
    : Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/**
 * Miniatura de carta móvil para «Mis menús» (dibujo simplificado del documento).
 */
export async function renderMobileDocumentThumbnail(
  doc: MobileMenuDocument,
  maxWidth = 400,
): Promise<string | null> {
  try {
    const vw = Math.max(280, doc.viewport?.width || 390);
    const vh = Math.max(500, doc.viewport?.height || 844);
    const canvas = document.createElement('canvas');
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const bg = doc.theme?.backgroundColor || '#f8fafc';
    const textColor = doc.theme?.textColor || '#111827';
    const accent = doc.theme?.accentColor || '#f59e0b';
    const fontFamily = doc.theme?.fontFamily || 'system-ui, sans-serif';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, vw, vh);

    const padX = 20;
    let y = 24;
    const contentW = vw - padX * 2;

    const components = (doc.components ?? []).filter((c) => c.hidden !== true);
    for (const component of components) {
      if (y > vh - 40) break;
      y = await drawMobileComponentThumb(ctx, component, {
        x: padX,
        y,
        width: contentW,
        textColor,
        accent,
        fontFamily,
      });
      y += 14;
    }

    const png = canvas.toDataURL('image/png');
    return await generateThumbnail(png, maxWidth);
  } catch {
    return null;
  }
}

async function drawMobileComponentThumb(
  ctx: CanvasRenderingContext2D,
  component: MobileComponent,
  opts: {
    x: number;
    y: number;
    width: number;
    textColor: string;
    accent: string;
    fontFamily: string;
  },
): Promise<number> {
  const { x, width, textColor, fontFamily } = opts;
  let y = opts.y;

  switch (component.type) {
    case 'section': {
      const pad = Math.min(component.padding ?? 16, 24);
      const minH =
        component.size === 's'
          ? 72
          : component.size === 'm'
            ? 96
            : component.size === 'l'
              ? 120
              : component.size === 'xl'
                ? 150
                : component.size === 'auto'
                  ? 56
                  : 72;
      const radius =
        component.borderRound === 'sm'
          ? 8
          : component.borderRound === 'md'
            ? 12
            : component.borderRound === 'lg'
              ? 16
              : component.borderRound === 'xl'
                ? 20
                : 10;
      drawRoundedRect(ctx, x, y, width, minH, radius);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = component.backgroundColor || '#ffffff';
      ctx.fillRect(x, y, width, minH);
      const bgSrc = component.backgroundImage?.src?.trim();
      if (bgSrc) {
        const img = await loadImage(bgSrc);
        if (img) {
          drawCoverImage(ctx, img, x, y, width, minH, component.backgroundImage?.stretch !== false);
        }
      }
      ctx.restore();
      ctx.fillStyle = component.typography?.color || textColor;
      ctx.font = `700 16px ${fontFamily}`;
      const offsetX = component.textOffsetX ?? 0;
      const offsetY = component.textOffsetY ?? 0;
      ctx.fillText(
        component.title || 'Sección',
        x + pad + offsetX,
        y + Math.min(28, minH - 8) + offsetY,
        Math.max(8, width - pad * 2),
      );
      return y + minH;
    }
    case 'heading': {
      const size = component.typography?.fontSize ?? 28;
      ctx.fillStyle = component.typography?.color || textColor;
      ctx.font = `700 ${Math.min(size, 32)}px ${fontFamily}`;
      ctx.textAlign = component.typography?.textAlign || 'left';
      const alignX =
        ctx.textAlign === 'center' ? x + width / 2 : ctx.textAlign === 'right' ? x + width : x;
      const lines = wrapText(ctx, component.text || 'Título', width, 2);
      for (const line of lines) {
        ctx.fillText(line, alignX, y + size * 0.85, width);
        y += size * 1.15;
      }
      ctx.textAlign = 'left';
      return y;
    }
    case 'text': {
      const size = component.typography?.fontSize ?? 14;
      ctx.fillStyle = component.typography?.color || '#374151';
      ctx.font = `400 ${Math.min(size, 16)}px ${fontFamily}`;
      const lines = wrapText(ctx, component.text || '', width, 3);
      for (const line of lines) {
        ctx.fillText(line, x, y + size * 0.9, width);
        y += size * 1.35;
      }
      return y;
    }
    case 'image': {
      const h = 120;
      const img = await loadImage(component.src);
      drawRoundedRect(ctx, x, y, width, h, component.radius ?? 12);
      ctx.save();
      ctx.clip();
      if (img) {
        drawCoverImage(ctx, img, x, y, width, h, true);
      } else {
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(x, y, width, h);
        ctx.fillStyle = '#9ca3af';
        ctx.font = `500 13px ${fontFamily}`;
        ctx.fillText('Imagen', x + 12, y + h / 2);
      }
      ctx.restore();
      return y + h;
    }
    case 'menuItem': {
      const hasImg = !!component.menuImage?.src?.trim();
      const thumbW = hasImg ? Math.min(component.menuImage?.width ?? 72, 80) : 0;
      const gap = hasImg ? 12 : 0;
      const contentX = component.menuImage?.position === 'right' ? x : x + thumbW + gap;
      const contentWidth = width - thumbW - gap;
      let rowY = y;

      if (hasImg) {
        const img = await loadImage(component.menuImage!.src);
        const thumbX = component.menuImage?.position === 'right' ? x + width - thumbW : x;
        const thumbH = thumbW;
        drawRoundedRect(ctx, thumbX, y, thumbW, thumbH, component.menuImage?.radius ?? 10);
        ctx.save();
        ctx.clip();
        if (img) {
          drawCoverImage(ctx, img, thumbX, y, thumbW, thumbH, true);
        } else {
          ctx.fillStyle = '#e5e7eb';
          ctx.fillRect(thumbX, y, thumbW, thumbH);
        }
        ctx.restore();
        rowY = Math.max(rowY, y + thumbH);
      }

      ctx.fillStyle = textColor;
      ctx.font = `700 15px ${fontFamily}`;
      const title = component.title || 'Plato';
      const price = (component.price || '').replace(/(\d)\s+€/g, '$1€').replace(/€\s+(\d)/g, '€$1');
      const priceW = ctx.measureText(price).width;
      ctx.fillText(title, contentX, y + 16, Math.max(40, contentWidth - priceW - 8));
      ctx.textAlign = 'right';
      ctx.fillText(price, contentX + contentWidth, y + 16);
      ctx.textAlign = 'left';

      ctx.fillStyle = '#6b7280';
      ctx.font = `400 12px ${fontFamily}`;
      const descLines = wrapText(ctx, component.description || '', contentWidth, 2);
      let ty = y + 34;
      for (const line of descLines) {
        ctx.fillText(line, contentX, ty, contentWidth);
        ty += 16;
      }
      if (component.ingredients) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = `400 11px ${fontFamily}`;
        const ing = wrapText(ctx, component.ingredients, contentWidth, 1);
        for (const line of ing) {
          ctx.fillText(line, contentX, ty, contentWidth);
          ty += 14;
        }
      }
      return Math.max(rowY, ty);
    }
    case 'button': {
      const h = 42;
      ctx.fillStyle = component.backgroundColor || '#111827';
      drawRoundedRect(ctx, x, y, width, h, 10);
      ctx.fill();
      ctx.fillStyle = component.textColor || '#ffffff';
      ctx.font = `600 14px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText(component.label || 'Botón', x + width / 2, y + 26, width - 16);
      ctx.textAlign = 'left';
      return y + h;
    }
    case 'divider': {
      ctx.strokeStyle = component.color || '#e5e7eb';
      ctx.lineWidth = Math.max(1, component.thickness || 1);
      ctx.beginPath();
      ctx.moveTo(x, y + 4);
      ctx.lineTo(x + width, y + 4);
      ctx.stroke();
      return y + 10;
    }
    case 'spacer': {
      return y + Math.min(Math.max(component.height || 16, 8), 48);
    }
    default:
      return y;
  }
}

/** Añade el sufijo «(Importado)» si aún no está. */
export function withImportedMenuTitle(title: string): string {
  const base = title.trim() || 'Menú';
  if (/\(\s*importado\s*\)/i.test(base)) return base;
  return `${base} (Importado)`;
}
