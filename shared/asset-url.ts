/** Normalización de URLs `/api/assets/file` (cliente + Functions). */

import { ASSET_FILE_MARKER, isAppAssetUrl } from './template-content-safety';

/**
 * Fuerza el formato query `?key=` para que funcione en todos los móviles
 * (evita rotura cuando el runtime convierte `%2F` del path en `/`).
 */
export function normalizeAssetUrl(src: string | null | undefined): string {
  if (!src) return '';
  const marker = ASSET_FILE_MARKER;
  const idx = src.indexOf(marker);
  if (idx === -1) return src;

  const rest = src.slice(idx + marker.length);

  if (rest.startsWith('?')) {
    try {
      const params = new URLSearchParams(rest.slice(1).split('#')[0]);
      const key = params.get('key');
      if (!key) return src;
      return `${marker}?key=${encodeURIComponent(decodeURIComponent(key))}`;
    } catch {
      return src;
    }
  }

  if (rest.startsWith('/')) {
    const pathPart = rest.slice(1).split('?')[0].split('#')[0];
    if (!pathPart) return src;
    try {
      const key = decodeURIComponent(pathPart);
      return `${marker}?key=${encodeURIComponent(key)}`;
    } catch {
      return `${marker}?key=${encodeURIComponent(pathPart)}`;
    }
  }

  return src;
}

/** Reescribe recursivamente URLs de assets al formato query estable. */
export function normalizeAssetUrlsInValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return isAppAssetUrl(value) ? normalizeAssetUrl(value) : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAssetUrlsInValue(item));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = normalizeAssetUrlsInValue(nested);
    }
    return out;
  }
  return value;
}
