import {
  assetUrlVariantsForKey,
  parseR2KeyFromAssetUrl,
} from '../../shared/template-content-safety';
import { findAssetByR2KeyAnyUser } from './db';
import { getAuthUser } from './middleware';
import { buildUserR2Prefix } from './r2';
import type { Env } from './types';

function escapeLikePattern(url: string): string {
  return url.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

async function isUrlReferencedInPublicMenus(db: D1Database, url: string): Promise<boolean> {
  const like = `%${escapeLikePattern(url)}%`;
  const row = await db
    .prepare(
      `SELECT 1 AS ok FROM menus
       WHERE is_public = 1
         AND (
           canvas_data LIKE ? ESCAPE '\\'
           OR IFNULL(mobile_document, '') LIKE ? ESCAPE '\\'
           OR IFNULL(thumbnail_url, '') LIKE ? ESCAPE '\\'
           OR IFNULL(export_png_url, '') LIKE ? ESCAPE '\\'
         )
       LIMIT 1`,
    )
    .bind(like, like, like, like)
    .first<{ ok: number }>();
  return Boolean(row);
}

async function isUrlReferencedInPublicTemplates(db: D1Database, url: string): Promise<boolean> {
  const like = `%${escapeLikePattern(url)}%`;
  const row = await db
    .prepare(
      `SELECT 1 AS ok FROM templates
       WHERE (user_id IS NULL OR is_public = 1)
         AND (
           canvas_data LIKE ? ESCAPE '\\'
           OR IFNULL(mobile_document, '') LIKE ? ESCAPE '\\'
           OR IFNULL(thumbnail_url, '') LIKE ? ESCAPE '\\'
         )
       LIMIT 1`,
    )
    .bind(like, like, like)
    .first<{ ok: number }>();
  return Boolean(row);
}

async function isR2KeyPubliclyAccessible(db: D1Database, r2Key: string): Promise<boolean> {
  try {
    for (const url of assetUrlVariantsForKey(r2Key)) {
      if (await isUrlReferencedInPublicMenus(db, url)) return true;
      if (await isUrlReferencedInPublicTemplates(db, url)) return true;
    }
  } catch (err) {
    console.error('isR2KeyPubliclyAccessible', r2Key, err);
  }
  return false;
}

/**
 * Lectura de archivos R2:
 * - Propietario autenticado (prefijo email o fila assets)
 * - Contenido referenciado en menú publicado o plantilla pública/sistema
 */
export async function canReadR2Asset(
  env: Env,
  request: Request,
  r2Key: string,
): Promise<boolean> {
  const viewer = await getAuthUser(request, env);
  if (viewer) {
    const prefix = buildUserR2Prefix(viewer.email);
    if (r2Key.startsWith(`${prefix}/`)) return true;

    const asset = await findAssetByR2KeyAnyUser(env.DB, r2Key);
    if (asset && asset.user_id === viewer.userId) return true;
  }

  return isR2KeyPubliclyAccessible(env.DB, r2Key);
}

/** Valida que una URL de asset apunte al bucket y sea legible. */
export async function canReadAssetUrl(
  env: Env,
  request: Request,
  url: string,
): Promise<boolean> {
  const r2Key = parseR2KeyFromAssetUrl(url);
  if (!r2Key) return false;
  return canReadR2Asset(env, request, r2Key);
}
