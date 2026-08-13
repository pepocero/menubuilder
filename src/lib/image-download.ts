import type { FabricImage } from 'fabric';
import { normalizeAssetUrl } from '@/lib/asset-url';
import { getLayerObjectData } from '@/lib/layer-utils';

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  const trimmed = name.replace(/[^\w\-áéíóúüñÁÉÍÓÚÜÑ. ]+/gi, '_').trim();
  return trimmed || 'imagen';
}

function extensionFromMime(mime: string): string | null {
  const type = mime.toLowerCase().split(';')[0]?.trim() ?? '';
  if (type === 'image/png') return 'png';
  if (type === 'image/jpeg' || type === 'image/jpg') return 'jpg';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/gif') return 'gif';
  if (type === 'image/svg+xml') return 'svg';
  if (type === 'image/bmp') return 'bmp';
  return null;
}

function extensionFromSrc(src: string): string | null {
  const dataMatch = src.match(/^data:image\/([a-z0-9+.-]+)/i);
  if (dataMatch) {
    const raw = dataMatch[1].toLowerCase();
    if (raw === 'jpeg') return 'jpg';
    if (raw === 'svg+xml') return 'svg';
    return raw.replace(/[^a-z0-9]/g, '') || null;
  }
  try {
    const url = new URL(src, window.location.href);
    const key = url.searchParams.get('key') ?? '';
    const path = key || url.pathname;
    const last = path.split('/').pop() ?? '';
    const match = last.match(/\.([a-z0-9]{2,5})$/i);
    if (match) return match[1].toLowerCase();
  } catch {
    /* ignore */
  }
  return null;
}

function filenameFromSrc(src: string): string | null {
  try {
    const url = new URL(src, window.location.href);
    const key = url.searchParams.get('key') ?? '';
    const raw = key || url.pathname.split('/').filter(Boolean).pop() || '';
    const decoded = decodeURIComponent(raw);
    const base = decoded.split('/').pop()?.trim() ?? '';
    if (base && /\.[a-z0-9]{2,5}$/i.test(base)) return sanitizeFilename(base);
  } catch {
    /* ignore */
  }
  return null;
}

function withExtension(base: string, ext: string): string {
  const lower = base.toLowerCase();
  if (lower.endsWith(`.${ext}`)) return base;
  return `${base}.${ext}`;
}

async function blobFromSrc(src: string): Promise<Blob | null> {
  if (!src) return null;
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    try {
      const res = await fetch(src);
      if (res.ok) return res.blob();
    } catch {
      return null;
    }
    return null;
  }

  for (const credentials of ['include', 'omit'] as const) {
    try {
      const res = await fetch(src, { mode: 'cors', credentials });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 0) return blob;
      }
    } catch {
      /* siguiente intento */
    }
  }
  return null;
}

async function blobFromElement(img: FabricImage): Promise<Blob | null> {
  const el = typeof img.getElement === 'function' ? img.getElement() : null;
  if (!(el instanceof HTMLImageElement) && !(el instanceof HTMLCanvasElement)) {
    return null;
  }
  const width =
    el instanceof HTMLImageElement ? el.naturalWidth || el.width : el.width;
  const height =
    el instanceof HTMLImageElement ? el.naturalHeight || el.height : el.height;
  if (!width || !height) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  try {
    ctx.drawImage(el, 0, 0);
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  } catch {
    return null;
  }
}

function resolveImageSrc(img: FabricImage): string {
  const data = getLayerObjectData(img);
  const fromData = typeof data.src === 'string' ? data.src.trim() : '';
  const fromFabric =
    typeof img.getSrc === 'function' ? (img.getSrc() ?? '').trim() : '';
  return normalizeAssetUrl(fromData || fromFabric);
}

/**
 * Descarga al ordenador el archivo original de una capa de imagen del lienzo.
 */
export async function downloadFabricImage(img: FabricImage): Promise<void> {
  const src = resolveImageSrc(img);
  const data = getLayerObjectData(img);
  const named = data.layerName?.trim();

  let blob = src ? await blobFromSrc(src) : null;
  if (!blob) blob = await blobFromElement(img);
  if (!blob) {
    throw new Error('No se pudo descargar la imagen');
  }

  const ext = extensionFromMime(blob.type) || extensionFromSrc(src) || 'png';
  const fromUrl = src ? filenameFromSrc(src) : null;
  const base = named
    ? sanitizeFilename(named)
    : fromUrl
      ? fromUrl.replace(/\.[a-z0-9]{2,5}$/i, '')
      : 'imagen';
  triggerBlobDownload(blob, withExtension(base, ext));
}
