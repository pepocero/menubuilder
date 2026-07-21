import type { AssetRow, Env, MenuRow, TemplateRow, UserRow } from './types';

export async function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db
    .prepare('SELECT id, email, password_hash, name, created_at FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first<UserRow>();
}

export async function findUserById(db: D1Database, id: string): Promise<UserRow | null> {
  return db
    .prepare('SELECT id, email, password_hash, name, created_at FROM users WHERE id = ?')
    .bind(id)
    .first<UserRow>();
}

export async function createUser(
  db: D1Database,
  id: string,
  email: string,
  passwordHash: string,
  name: string | null,
): Promise<void> {
  await db
    .prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)')
    .bind(id, email.toLowerCase(), passwordHash, name)
    .run();
}

export async function storeRefreshToken(
  db: D1Database,
  id: string,
  userId: string,
  tokenHash: string,
  expiresAt: string,
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked) VALUES (?, ?, ?, ?, 0)',
    )
    .bind(id, userId, tokenHash, expiresAt)
    .run();
}

export async function findRefreshToken(
  db: D1Database,
  tokenHash: string,
): Promise<{ id: string; user_id: string; expires_at: string; revoked: number } | null> {
  return db
    .prepare(
      'SELECT id, user_id, expires_at, revoked FROM refresh_tokens WHERE token_hash = ? LIMIT 1',
    )
    .bind(tokenHash)
    .first();
}

export async function revokeRefreshToken(db: D1Database, tokenHash: string): Promise<void> {
  await db
    .prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?')
    .bind(tokenHash)
    .run();
}

export async function revokeAllUserRefreshTokens(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?')
    .bind(userId)
    .run();
}

/** Listado del dashboard: no pide canvas ni columnas de export (evita 500 si falta migración 0006). */
export async function listMenusByUser(db: D1Database, userId: string): Promise<MenuRow[]> {
  const result = await db
    .prepare(
      `SELECT id, user_id, title, template_id, thumbnail_url, is_public, public_slug, created_at, updated_at
       FROM menus WHERE user_id = ? ORDER BY updated_at DESC`,
    )
    .bind(userId)
    .all<MenuRow>();
  return (result.results ?? []).map((row) => ({
    ...row,
    canvas_data: row.canvas_data ?? '',
    menu_document: row.menu_document ?? null,
    export_png_url: row.export_png_url ?? null,
  }));
}

export async function getMenuById(db: D1Database, id: string): Promise<MenuRow | null> {
  return db
    .prepare(
      `SELECT id, user_id, title, template_id, canvas_data, thumbnail_url, menu_document, export_png_url, is_public, public_slug, created_at, updated_at
       FROM menus WHERE id = ?`,
    )
    .bind(id)
    .first<MenuRow>();
}

export async function createMenu(
  db: D1Database,
  id: string,
  userId: string,
  title: string,
  canvasData: string,
  templateId: string | null,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO menus (id, user_id, title, template_id, canvas_data, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    )
    .bind(id, userId, title, templateId, canvasData)
    .run();
}

export async function updateMenu(
  db: D1Database,
  id: string,
  userId: string,
  title: string,
  canvasData: string,
  thumbnailUrl: string | null,
  menuDocument: string | null,
  exportPngUrl: string | null,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE menus SET title = ?, canvas_data = ?, thumbnail_url = ?, menu_document = ?, export_png_url = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    )
    .bind(title, canvasData, thumbnailUrl, menuDocument, exportPngUrl, id, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function deleteMenu(db: D1Database, id: string, userId: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM menus WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function publishMenu(
  db: D1Database,
  id: string,
  userId: string,
  slug: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE menus SET is_public = 1, public_slug = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    )
    .bind(slug, id, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function unpublishMenu(
  db: D1Database,
  id: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE menus SET is_public = 0, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    )
    .bind(id, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function getPublicMenuBySlug(db: D1Database, slug: string): Promise<MenuRow | null> {
  return db
    .prepare(
      `SELECT id, user_id, title, template_id, canvas_data, thumbnail_url, menu_document, export_png_url, is_public, public_slug, created_at, updated_at
       FROM menus WHERE public_slug = ? AND is_public = 1`,
    )
    .bind(slug)
    .first<MenuRow>();
}

export async function listPublishedMenusByUser(db: D1Database, userId: string): Promise<MenuRow[]> {
  const result = await db
    .prepare(
      `SELECT id, user_id, title, template_id, canvas_data, thumbnail_url, menu_document, export_png_url, is_public, public_slug, created_at, updated_at
       FROM menus WHERE user_id = ? AND is_public = 1 AND public_slug IS NOT NULL
       ORDER BY updated_at DESC`,
    )
    .bind(userId)
    .all<MenuRow>();
  return result.results ?? [];
}

export async function listTemplates(db: D1Database): Promise<TemplateRow[]> {
  const result = await db
    .prepare(
      'SELECT id, name, category, canvas_data, thumbnail_url, is_premium FROM templates ORDER BY category, name',
    )
    .all<TemplateRow>();
  return result.results ?? [];
}

export async function getTemplateById(db: D1Database, id: string): Promise<TemplateRow | null> {
  return db
    .prepare(
      'SELECT id, name, category, canvas_data, thumbnail_url, is_premium FROM templates WHERE id = ?',
    )
    .bind(id)
    .first<TemplateRow>();
}

export async function createAsset(
  db: D1Database,
  id: string,
  userId: string,
  type: string,
  r2Key: string,
  url: string,
  source: string,
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO assets (id, user_id, type, r2_key, url, source) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(id, userId, type, r2Key, url, source)
    .run();
}

export async function listAssetsByUser(db: D1Database, userId: string): Promise<AssetRow[]> {
  const result = await db
    .prepare(
      'SELECT id, user_id, type, r2_key, url, source, created_at FROM assets WHERE user_id = ? ORDER BY created_at DESC',
    )
    .bind(userId)
    .all<AssetRow>();
  return result.results ?? [];
}

export async function findAssetByUrl(
  db: D1Database,
  userId: string,
  url: string,
): Promise<AssetRow | null> {
  return db
    .prepare(
      'SELECT id, user_id, type, r2_key, url, source, created_at FROM assets WHERE user_id = ? AND url = ? LIMIT 1',
    )
    .bind(userId, url)
    .first<AssetRow>();
}

export async function findAssetByR2Key(
  db: D1Database,
  userId: string,
  r2Key: string,
): Promise<AssetRow | null> {
  return db
    .prepare(
      'SELECT id, user_id, type, r2_key, url, source, created_at FROM assets WHERE user_id = ? AND r2_key = ? LIMIT 1',
    )
    .bind(userId, r2Key)
    .first<AssetRow>();
}

export async function findAssetById(
  db: D1Database,
  userId: string,
  id: string,
): Promise<AssetRow | null> {
  return db
    .prepare(
      'SELECT id, user_id, type, r2_key, url, source, created_at FROM assets WHERE user_id = ? AND id = ? LIMIT 1',
    )
    .bind(userId, id)
    .first<AssetRow>();
}

export async function deleteAssetRow(
  db: D1Database,
  id: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM assets WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/** Cuenta menús del usuario (opcionalmente excluyendo uno) que aún referencian la URL en canvas_data */
export async function countMenusReferencingAssetUrl(
  db: D1Database,
  userId: string,
  url: string,
  excludeMenuId?: string,
): Promise<number> {
  if (excludeMenuId) {
    const row = await db
      .prepare(
        `SELECT COUNT(*) as c FROM menus
         WHERE user_id = ? AND id != ? AND canvas_data LIKE ?`,
      )
      .bind(userId, excludeMenuId, `%${url}%`)
      .first<{ c: number }>();
    return row?.c ?? 0;
  }

  const row = await db
    .prepare(
      `SELECT COUNT(*) as c FROM menus
       WHERE user_id = ? AND canvas_data LIKE ?`,
    )
    .bind(userId, `%${url}%`)
    .first<{ c: number }>();
  return row?.c ?? 0;
}

export function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (const byte of bytes) {
    slug += chars[byte % chars.length];
  }
  return slug;
}
