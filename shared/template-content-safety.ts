/** Detección y limpieza de enlaces públicos / assets en plantillas (cliente + servidor). */

export const ASSET_FILE_MARKER = '/api/assets/file';

/** Carpeta R2 legible asociada al email (misma lógica que functions/lib/r2.ts). */
export function sanitizeUserStorageFolder(email: string): string {
  const normalized = email.trim().toLowerCase();
  const folder = normalized
    .replace(/@/g, '_at_')
    .replace(/[^a-z0-9._+-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 180);
  return folder || 'unknown';
}

/** Ruta pública de carta: /p/{slug} */
const PUBLIC_MENU_PATH_RE = /\/p\/[a-z0-9-]+(?:\/|$|[?#])/i;

/** URL absoluta a carta pública del sitio */
const PUBLIC_MENU_ABS_RE = /^https?:\/\/[^/\s]+\/p\/[a-z0-9-]+(?:\/|$|[?#])/i;

/** Export PNG de menú publicado en R2 */
const MENU_EXPORT_KEY_RE = /\/menus\/[^/]+\/menu\.png$/i;

export function parseR2KeyFromAssetUrl(url: string): string | null {
  try {
    const marker = ASSET_FILE_MARKER;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;

    const rest = url.slice(idx + marker.length);
    if (rest.startsWith('?')) {
      const params = new URLSearchParams(rest.slice(1).split('#')[0]);
      const key = params.get('key');
      if (!key) return null;
      return decodeURIComponent(key);
    }

    if (rest.startsWith('/')) {
      const encoded = rest.slice(1).split('?')[0].split('#')[0];
      if (!encoded) return null;
      return decodeURIComponent(encoded);
    }

    return null;
  } catch {
    return null;
  }
}

export function isAppAssetUrl(url: string): boolean {
  return typeof url === 'string' && url.includes(ASSET_FILE_MARKER);
}

export function isMenuExportAssetKey(r2Key: string): boolean {
  return MENU_EXPORT_KEY_RE.test(r2Key);
}

export function isMenuExportAssetUrl(url: string): boolean {
  const key = parseR2KeyFromAssetUrl(url);
  return key ? isMenuExportAssetKey(key) : false;
}

export function isPublicMenuUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === '#') return false;
  return PUBLIC_MENU_PATH_RE.test(trimmed) || PUBLIC_MENU_ABS_RE.test(trimmed);
}

/** Sustituye enlaces a cartas públicas por placeholder neutro. */
export function sanitizePublicMenuUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;
  let result = url;
  result = result.replace(/https?:\/\/[^/\s]+\/p\/[a-z0-9-]+/gi, '#');
  result = result.replace(/\/p\/[a-z0-9-]+/gi, '#');
  return result;
}

export function assetUrlVariantsForKey(r2Key: string): string[] {
  return [
    `/api/assets/file?key=${encodeURIComponent(r2Key)}`,
    `/api/assets/file/${encodeURIComponent(r2Key)}`,
  ];
}

export function belongsToUserR2Prefix(r2Key: string, userStorageFolder: string): boolean {
  const prefix = `users/${userStorageFolder}/`;
  return r2Key.startsWith(prefix);
}

export function collectAssetUrlsFromValue(
  value: unknown,
  out: Set<string> = new Set(),
): Set<string> {
  if (typeof value === 'string') {
    if (isAppAssetUrl(value)) out.add(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAssetUrlsFromValue(item, out);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectAssetUrlsFromValue(nested, out);
    }
  }
  return out;
}

export function collectPublicMenuUrlsFromValue(
  value: unknown,
  out: Set<string> = new Set(),
): Set<string> {
  if (typeof value === 'string') {
    if (isPublicMenuUrl(value)) out.add(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPublicMenuUrlsFromValue(item, out);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectPublicMenuUrlsFromValue(nested, out);
    }
  }
  return out;
}

export interface TemplateContentScanInput {
  canvas_data?: unknown;
  mobile_document?: unknown;
  thumbnail_url?: string | null;
}

export interface TemplateContentScanResult {
  publicLinkCount: number;
  foreignAssetCount: number;
  menuExportThumbnail: boolean;
}

export function scanTemplateContentIssues(
  content: TemplateContentScanInput,
  ownerStorageFolder: string | null,
): TemplateContentScanResult {
  const assetUrls = new Set<string>();
  if (content.canvas_data !== undefined) {
    collectAssetUrlsFromValue(content.canvas_data, assetUrls);
  }
  if (content.mobile_document !== undefined) {
    collectAssetUrlsFromValue(content.mobile_document, assetUrls);
  }
  if (content.thumbnail_url && isAppAssetUrl(content.thumbnail_url)) {
    assetUrls.add(content.thumbnail_url);
  }

  const publicUrls = new Set<string>();
  if (content.canvas_data !== undefined) {
    collectPublicMenuUrlsFromValue(content.canvas_data, publicUrls);
  }
  if (content.mobile_document !== undefined) {
    collectPublicMenuUrlsFromValue(content.mobile_document, publicUrls);
  }

  let foreignAssetCount = 0;
  if (ownerStorageFolder) {
    for (const url of assetUrls) {
      const key = parseR2KeyFromAssetUrl(url);
      if (!key) continue;
      if (isMenuExportAssetKey(key)) {
        foreignAssetCount += 1;
        continue;
      }
      if (!belongsToUserR2Prefix(key, ownerStorageFolder)) {
        foreignAssetCount += 1;
      }
    }
  } else {
    foreignAssetCount = assetUrls.size;
  }

  const menuExportThumbnail = Boolean(
    content.thumbnail_url &&
      (isMenuExportAssetUrl(content.thumbnail_url) || isPublicMenuUrl(content.thumbnail_url)),
  );

  return {
    publicLinkCount: publicUrls.size,
    foreignAssetCount,
    menuExportThumbnail,
  };
}

function normalizeButtonActions(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeButtonActions);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const obj = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(obj)) {
    next[key] = normalizeButtonActions(nested);
  }

  if (next.type === 'button') {
    const href = typeof next.href === 'string' ? next.href : '';
    if (href === '#' || isPublicMenuUrl(href)) {
      next.href = '#';
      next.action = { type: 'none' };
    } else if (
      next.action &&
      typeof next.action === 'object' &&
      (next.action as Record<string, unknown>).type === 'url'
    ) {
      const action = next.action as Record<string, unknown>;
      const actionUrl = typeof action.url === 'string' ? action.url : '';
      if (actionUrl === '#' || isPublicMenuUrl(actionUrl)) {
        next.action = { type: 'none' };
      }
    }
  }

  return next;
}

function sanitizeStringsInValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizePublicMenuUrl(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeStringsInValue);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sanitizeStringsInValue(nested);
    }
    return out;
  }
  return value;
}

/** Elimina enlaces /p/… del JSON de diseño (sin clonar assets). */
export function sanitizePublicLinksInJson(value: unknown): unknown {
  return normalizeButtonActions(sanitizeStringsInValue(value));
}

export function replaceAssetUrlsInValue(
  value: unknown,
  keyToNewUrl: Map<string, string>,
): unknown {
  if (typeof value === 'string') {
    const directKey = parseR2KeyFromAssetUrl(value);
    if (directKey && keyToNewUrl.has(directKey)) {
      return keyToNewUrl.get(directKey)!;
    }
    let result = value;
    for (const [r2Key, newUrl] of keyToNewUrl) {
      for (const variant of assetUrlVariantsForKey(r2Key)) {
        if (result.includes(variant)) {
          result = result.split(variant).join(newUrl);
        }
      }
    }
    return result;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceAssetUrlsInValue(item, keyToNewUrl));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = replaceAssetUrlsInValue(nested, keyToNewUrl);
    }
    return out;
  }
  return value;
}

export function sanitizeThumbnailForSharing(thumbnailUrl: string | null): string | null {
  if (!thumbnailUrl) return null;
  if (isMenuExportAssetUrl(thumbnailUrl) || isPublicMenuUrl(thumbnailUrl)) return null;
  return thumbnailUrl;
}
