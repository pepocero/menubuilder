import { parseR2KeyFromAssetUrl } from '../../shared/template-content-safety';
import { findAssetByR2KeyAnyUser } from './db';
import { getAuthUser } from './middleware';
import { buildUserR2Prefix } from './r2';
import type { Env } from './types';

/**
 * Lectura de archivos R2 en GET:
 *
 * Las URLs `/api/assets/file?key=users/…` son el CDN de la app. Las claves
 * incluyen UUID/email y no son enumerables. Bloquear lecturas anónimas con
 * consultas LIKE sobre JSON en D1 provocaba 403/timeouts masivos al escanear
 * el QR (decenas de móviles a la vez).
 *
 * Política:
 * - Cualquier clave `users/…` es legible en GET (carta pública / editor).
 * - Escritura/borrado sigue autenticada en otras rutas.
 */
export async function canReadR2Asset(
  _env: Env,
  _request: Request,
  r2Key: string,
): Promise<boolean> {
  return typeof r2Key === 'string' && r2Key.startsWith('users/') && !r2Key.includes('..');
}

/** Comprueba propiedad (para operaciones autenticadas que lo necesiten). */
export async function canOwnR2Asset(
  env: Env,
  request: Request,
  r2Key: string,
): Promise<boolean> {
  const viewer = await getAuthUser(request, env);
  if (!viewer) return false;

  const prefix = buildUserR2Prefix(viewer.email);
  if (r2Key.startsWith(`${prefix}/`)) return true;

  const asset = await findAssetByR2KeyAnyUser(env.DB, r2Key);
  return Boolean(asset && asset.user_id === viewer.userId);
}

export async function canReadAssetUrl(
  env: Env,
  request: Request,
  url: string,
): Promise<boolean> {
  const r2Key = parseR2KeyFromAssetUrl(url);
  if (!r2Key) return false;
  return canReadR2Asset(env, request, r2Key);
}
