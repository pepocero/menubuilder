/** Assets de cartas públicas: recolección de claves R2 y URLs del proxy /api/public/menus/:slug/file */

import {
  ASSET_FILE_MARKER,
  collectAssetUrlsFromValue,
  isAppAssetUrl,
  parseR2KeyFromAssetUrl,
} from './template-content-safety';

export interface PublicMenuAssetSource {
  canvas_data?: unknown;
  mobile_document?: unknown;
  menu_document?: unknown;
  thumbnail_url?: string | null;
  export_png_url?: string | null;
}

function ingestR2Key(keys: Set<string>, r2Key: string | null | undefined): void {
  if (r2Key && r2Key.startsWith('users/')) {
    keys.add(r2Key);
  }
}

/** Claves R2 referenciadas en el contenido de una carta publicada. */
export function collectR2KeysFromMenuContent(source: PublicMenuAssetSource): Set<string> {
  const keys = new Set<string>();

  const ingestValue = (value: unknown) => {
    for (const url of collectAssetUrlsFromValue(value)) {
      ingestR2Key(keys, parseR2KeyFromAssetUrl(url));
    }
  };

  ingestValue(source.canvas_data);
  ingestValue(source.mobile_document);
  ingestValue(source.menu_document);

  if (source.thumbnail_url) {
    ingestR2Key(keys, parseR2KeyFromAssetUrl(source.thumbnail_url));
  }
  if (source.export_png_url) {
    ingestR2Key(keys, parseR2KeyFromAssetUrl(source.export_png_url));
  }

  return keys;
}

export function buildPublicMenuAssetPath(slug: string, r2Key: string): string {
  return `/api/public/menus/${encodeURIComponent(slug)}/file?key=${encodeURIComponent(r2Key)}`;
}

/** Convierte una URL de asset de la app al proxy público de la carta. */
export function toPublicMenuAssetUrl(slug: string, src: string | null | undefined): string {
  if (!src) return '';
  const trimmed = src.trim();
  if (!trimmed || !trimmed.includes(ASSET_FILE_MARKER)) return trimmed;
  const r2Key = parseR2KeyFromAssetUrl(trimmed);
  if (!r2Key) return trimmed;
  return buildPublicMenuAssetPath(slug, r2Key);
}

/** Reescribe recursivamente URLs /api/assets/file → proxy público por slug. */
export function rewriteAssetUrlsForPublicSlug(value: unknown, slug: string): unknown {
  if (typeof value === 'string') {
    if (!isAppAssetUrl(value)) return value;
    return toPublicMenuAssetUrl(slug, value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteAssetUrlsForPublicSlug(item, slug));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = rewriteAssetUrlsForPublicSlug(nested, slug);
    }
    return out;
  }
  return value;
}
