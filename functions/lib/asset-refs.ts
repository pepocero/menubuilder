import {
  countForeignTemplatesReferencingAssetUrl,
  countMenusReferencingAssetUrl,
  countOtherUsersMenusReferencingAssetUrl,
  countTemplatesReferencingAssetUrl,
  deleteAssetRow,
  findAssetByR2Key,
  findAssetByUrl,
} from './db';
import type { AssetRow } from './types';
import { deleteFromR2, parseR2KeyFromAssetUrl } from './r2';

/** Recorre JSON y recoge URLs de assets propios (`/api/assets/file`). */
export function collectAssetUrlsFromValue(
  value: unknown,
  out: Set<string> = new Set(),
): Set<string> {
  if (typeof value === 'string') {
    if (value.includes('/api/assets/file')) out.add(value);
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

export function collectAssetUrlsFromJsonText(json: string | null | undefined): Set<string> {
  if (!json) return new Set();
  try {
    return collectAssetUrlsFromValue(JSON.parse(json));
  } catch {
    // Fallback por si el JSON está corrupto pero aún contiene URLs
    const out = new Set<string>();
    const re = /\/api\/assets\/file(?:\?key=[^"\\s]+|\/[^"\\s]+)/g;
    for (const match of json.matchAll(re)) {
      out.add(match[0].replace(/\\+$/, ''));
    }
    return out;
  }
}

export function collectAssetUrlsFromMenuRow(menu: {
  canvas_data?: string | null;
  mobile_document?: string | null;
  menu_document?: string | null;
  thumbnail_url?: string | null;
  export_png_url?: string | null;
}): Set<string> {
  const out = new Set<string>();
  for (const url of collectAssetUrlsFromJsonText(menu.canvas_data)) out.add(url);
  for (const url of collectAssetUrlsFromJsonText(menu.mobile_document)) out.add(url);
  for (const url of collectAssetUrlsFromJsonText(menu.menu_document)) out.add(url);
  if (menu.thumbnail_url?.includes('/api/assets/file')) out.add(menu.thumbnail_url);
  if (menu.export_png_url?.includes('/api/assets/file')) out.add(menu.export_png_url);
  return out;
}

async function resolveAsset(
  db: D1Database,
  userId: string,
  url: string,
): Promise<AssetRow | null> {
  let asset = await findAssetByUrl(db, userId, url);
  if (!asset) {
    const key = parseR2KeyFromAssetUrl(url);
    if (key) asset = await findAssetByR2Key(db, userId, key);
  }
  return asset;
}

/** Variantes de URL con las que un mismo archivo puede aparecer en menús. */
export function assetUrlVariants(asset: AssetRow, preferredUrl?: string): string[] {
  const urls = new Set<string>();
  if (preferredUrl) urls.add(preferredUrl);
  if (asset.url) urls.add(asset.url);
  if (asset.r2_key) {
    urls.add(`/api/assets/file?key=${encodeURIComponent(asset.r2_key)}`);
    urls.add(`/api/assets/file/${encodeURIComponent(asset.r2_key)}`);
  }
  return [...urls];
}

/**
 * Cuenta menús que referencian el asset (cualquier forma de URL).
 * Opcionalmente excluye un menú (p. ej. al borrar imagen del editor actual).
 */
export async function countMenusReferencingAsset(
  db: D1Database,
  userId: string,
  asset: AssetRow,
  preferredUrl?: string,
  excludeMenuId?: string,
): Promise<number> {
  let total = 0;
  const seen = new Set<string>();
  for (const url of assetUrlVariants(asset, preferredUrl)) {
    if (seen.has(url)) continue;
    seen.add(url);
    total += await countMenusReferencingAssetUrl(db, userId, url, excludeMenuId);
    total += await countTemplatesReferencingAssetUrl(db, userId, url);
    total += await countOtherUsersMenusReferencingAssetUrl(db, userId, url);
    total += await countForeignTemplatesReferencingAssetUrl(db, userId, url);
  }
  return total;
}

/** Borra de R2+D1 si ningún menú (salvo exclude) referencia el archivo. */
export async function deleteAssetIfUnreferenced(
  env: { DB: D1Database; MEDIA?: R2Bucket },
  userId: string,
  url: string,
  options?: { excludeMenuId?: string; force?: boolean },
): Promise<{ deleted: boolean; kept?: boolean; reason?: string; assetId?: string }> {
  const asset = await resolveAsset(env.DB, userId, url);
  if (!asset || asset.user_id !== userId) {
    return { deleted: false, reason: 'not_found' };
  }

  if (!options?.force) {
    const refs = await countMenusReferencingAsset(
      env.DB,
      userId,
      asset,
      url,
      options?.excludeMenuId,
    );
    if (refs > 0) {
      return {
        deleted: false,
        kept: true,
        reason: 'La imagen sigue usándose en otro menú',
        assetId: asset.id,
      };
    }
  }

  if (env.MEDIA) {
    try {
      await deleteFromR2(env.MEDIA, asset.r2_key);
    } catch (err) {
      console.error('R2 delete falló (se continúa borrando fila D1)', asset.r2_key, err);
    }
  }
  await deleteAssetRow(env.DB, asset.id, userId);
  return { deleted: true, assetId: asset.id };
}

/** Tras actualizar/borrar un menú: elimina assets que ya no salen en ningún menú. */
export async function garbageCollectRemovedAssetUrls(
  env: { DB: D1Database; MEDIA?: R2Bucket },
  userId: string,
  removedUrls: Iterable<string>,
): Promise<void> {
  for (const url of removedUrls) {
    if (!url.includes('/api/assets/file')) continue;
    try {
      await deleteAssetIfUnreferenced(env, userId, url);
    } catch (err) {
      console.error('GC asset falló', url, err);
    }
  }
}
