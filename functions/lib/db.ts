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

/** Listado global de usuarios (solo panel system_admin). Sin password_hash. */
export async function listAllUsers(db: D1Database): Promise<
  Array<{ id: string; email: string; name: string | null; created_at: string }>
> {
  const result = await db
    .prepare(
      'SELECT id, email, name, created_at FROM users ORDER BY created_at DESC',
    )
    .all<{ id: string; email: string; name: string | null; created_at: string }>();
  return result.results ?? [];
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
      `SELECT id, user_id, title, template_id, thumbnail_url, editor_kind, mobile_document, is_public, public_slug, created_at, updated_at
       FROM menus WHERE user_id = ? ORDER BY updated_at DESC`,
    )
    .bind(userId)
    .all<MenuRow>();
  return (result.results ?? []).map((row) => ({
    ...row,
    canvas_data: row.canvas_data ?? '',
    editor_kind: (row.editor_kind as MenuRow['editor_kind']) ?? 'canvas',
    mobile_document: row.mobile_document ?? null,
    menu_document: row.menu_document ?? null,
    export_png_url: row.export_png_url ?? null,
  }));
}

export async function getMenuById(db: D1Database, id: string): Promise<MenuRow | null> {
  return db
    .prepare(
      `SELECT id, user_id, title, template_id, canvas_data, thumbnail_url, editor_kind, mobile_document, menu_document, export_png_url, is_public, public_slug, created_at, updated_at
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
  editorKind: MenuRow['editor_kind'] = 'canvas',
  mobileDocument: string | null = null,
  thumbnailUrl: string | null = null,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO menus (id, user_id, title, template_id, canvas_data, editor_kind, mobile_document, thumbnail_url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .bind(id, userId, title, templateId, canvasData, editorKind, mobileDocument, thumbnailUrl)
    .run();
}

export async function updateMenu(
  db: D1Database,
  id: string,
  userId: string,
  title: string,
  canvasData: string,
  editorKind: MenuRow['editor_kind'],
  mobileDocument: string | null,
  thumbnailUrl: string | null,
  menuDocument: string | null,
  exportPngUrl: string | null,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE menus SET title = ?, canvas_data = ?, editor_kind = ?, mobile_document = ?, thumbnail_url = ?, menu_document = ?, export_png_url = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    )
    .bind(title, canvasData, editorKind, mobileDocument, thumbnailUrl, menuDocument, exportPngUrl, id, userId)
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

/** Desactiva el enlace público sin borrar slug ni PNG de exportación. */
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

/** Elimina por completo la publicación: slug, PNG público e is_public. */
export async function removeMenuPublication(
  db: D1Database,
  id: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE menus SET is_public = 0, public_slug = NULL, export_png_url = NULL, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    )
    .bind(id, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function getPublicMenuBySlug(db: D1Database, slug: string): Promise<MenuRow | null> {
  return db
    .prepare(
      `SELECT id, user_id, title, template_id, canvas_data, thumbnail_url, editor_kind, mobile_document, menu_document, export_png_url, is_public, public_slug, created_at, updated_at
       FROM menus WHERE public_slug = ? AND is_public = 1`,
    )
    .bind(slug)
    .first<MenuRow>();
}

/** Cartas con enlace/QR asignado (activas o despublicadas). */
export async function listPublishedMenusByUser(db: D1Database, userId: string): Promise<MenuRow[]> {
  const result = await db
    .prepare(
      `SELECT id, user_id, title, template_id, canvas_data, thumbnail_url, editor_kind, mobile_document, menu_document, export_png_url, is_public, public_slug, created_at, updated_at
       FROM menus WHERE user_id = ? AND public_slug IS NOT NULL
       ORDER BY updated_at DESC`,
    )
    .bind(userId)
    .all<MenuRow>();
  return result.results ?? [];
}

export async function listTemplates(db: D1Database): Promise<TemplateRow[]> {
  const result = await db
    .prepare(
      `SELECT t.id, t.name, t.category, t.canvas_data, t.thumbnail_url, t.is_premium,
              t.user_id, t.is_public, t.created_at, t.updated_at, t.editor_kind, t.mobile_document,
              u.name AS author_name
       FROM templates t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.user_id IS NULL OR t.is_public = 1
       ORDER BY CASE WHEN t.user_id IS NULL THEN 0 ELSE 1 END, t.category, t.name`,
    )
    .all<TemplateRow>();
  return result.results ?? [];
}

export async function listMyTemplates(db: D1Database, userId: string): Promise<TemplateRow[]> {
  const result = await db
    .prepare(
      `SELECT id, name, category, canvas_data, thumbnail_url, is_premium,
              user_id, is_public, created_at, updated_at, editor_kind, mobile_document
       FROM templates
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
    )
    .bind(userId)
    .all<TemplateRow>();
  return result.results ?? [];
}

export async function getTemplateById(db: D1Database, id: string): Promise<TemplateRow | null> {
  return db
    .prepare(
      `SELECT t.id, t.name, t.category, t.canvas_data, t.thumbnail_url, t.is_premium,
              t.user_id, t.is_public, t.created_at, t.updated_at, t.editor_kind, t.mobile_document,
              u.name AS author_name
       FROM templates t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.id = ?`,
    )
    .bind(id)
    .first<TemplateRow>();
}

export async function createUserTemplate(
  db: D1Database,
  id: string,
  userId: string,
  name: string,
  canvasData: string,
  thumbnailUrl: string | null,
  editorKind: TemplateRow['editor_kind'] = 'canvas',
  mobileDocument: string | null = null,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO templates (id, user_id, name, category, canvas_data, thumbnail_url, is_premium, is_public, editor_kind, mobile_document, created_at, updated_at)
       VALUES (?, ?, ?, 'comunidad', ?, ?, 0, 0, ?, ?, datetime('now'), datetime('now'))`,
    )
    .bind(id, userId, name, canvasData, thumbnailUrl, editorKind, mobileDocument)
    .run();
}

export async function setTemplatePublic(
  db: D1Database,
  id: string,
  userId: string,
  isPublic: boolean,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE templates SET is_public = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    )
    .bind(isPublic ? 1 : 0, id, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function deleteUserTemplate(
  db: D1Database,
  id: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM templates WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function updateUserTemplateContent(
  db: D1Database,
  id: string,
  userId: string,
  canvasData: string,
  mobileDocument: string | null,
  thumbnailUrl: string | null,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE templates SET canvas_data = ?, mobile_document = ?, thumbnail_url = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    )
    .bind(canvasData, mobileDocument, thumbnailUrl, id, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
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

export async function findAssetByR2KeyAnyUser(
  db: D1Database,
  r2Key: string,
): Promise<AssetRow | null> {
  return db
    .prepare(
      'SELECT id, user_id, type, r2_key, url, source, created_at FROM assets WHERE r2_key = ? LIMIT 1',
    )
    .bind(r2Key)
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

function escapeLikePattern(url: string): string {
  return url.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Cuenta plantillas del usuario que referencian la URL */
export async function countTemplatesReferencingAssetUrl(
  db: D1Database,
  userId: string,
  url: string,
): Promise<number> {
  const like = `%${escapeLikePattern(url)}%`;
  const row = await db
    .prepare(
      `SELECT COUNT(*) as c FROM templates
       WHERE user_id = ?
         AND (
           canvas_data LIKE ? ESCAPE '\\'
           OR IFNULL(mobile_document, '') LIKE ? ESCAPE '\\'
           OR IFNULL(thumbnail_url, '') LIKE ? ESCAPE '\\'
         )`,
    )
    .bind(userId, like, like, like)
    .first<{ c: number }>();
  return row?.c ?? 0;
}

/** Menús de otros usuarios que referencian la URL */
export async function countOtherUsersMenusReferencingAssetUrl(
  db: D1Database,
  userId: string,
  url: string,
): Promise<number> {
  const like = `%${escapeLikePattern(url)}%`;
  const row = await db
    .prepare(
      `SELECT COUNT(*) as c FROM menus
       WHERE user_id != ?
         AND (
           canvas_data LIKE ? ESCAPE '\\'
           OR IFNULL(mobile_document, '') LIKE ? ESCAPE '\\'
           OR IFNULL(menu_document, '') LIKE ? ESCAPE '\\'
           OR IFNULL(thumbnail_url, '') LIKE ? ESCAPE '\\'
           OR IFNULL(export_png_url, '') LIKE ? ESCAPE '\\'
         )`,
    )
    .bind(userId, like, like, like, like, like)
    .first<{ c: number }>();
  return row?.c ?? 0;
}

/** Plantillas ajenas (públicas o de sistema) que referencian la URL */
export async function countForeignTemplatesReferencingAssetUrl(
  db: D1Database,
  userId: string,
  url: string,
): Promise<number> {
  const like = `%${escapeLikePattern(url)}%`;
  const row = await db
    .prepare(
      `SELECT COUNT(*) as c FROM templates
       WHERE (user_id IS NULL OR user_id != ?)
         AND (
           canvas_data LIKE ? ESCAPE '\\'
           OR IFNULL(mobile_document, '') LIKE ? ESCAPE '\\'
           OR IFNULL(thumbnail_url, '') LIKE ? ESCAPE '\\'
         )`,
    )
    .bind(userId, like, like, like)
    .first<{ c: number }>();
  return row?.c ?? 0;
}

/** Cuenta menús del usuario (opcionalmente excluyendo uno) que referencian la URL */
export async function countMenusReferencingAssetUrl(
  db: D1Database,
  userId: string,
  url: string,
  excludeMenuId?: string,
): Promise<number> {
  const like = `%${escapeLikePattern(url)}%`;
  if (excludeMenuId) {
    const row = await db
      .prepare(
        `SELECT COUNT(*) as c FROM menus
         WHERE user_id = ? AND id != ?
           AND (
             canvas_data LIKE ? ESCAPE '\\'
             OR IFNULL(mobile_document, '') LIKE ? ESCAPE '\\'
             OR IFNULL(menu_document, '') LIKE ? ESCAPE '\\'
             OR IFNULL(thumbnail_url, '') LIKE ? ESCAPE '\\'
             OR IFNULL(export_png_url, '') LIKE ? ESCAPE '\\'
           )`,
      )
      .bind(userId, excludeMenuId, like, like, like, like, like)
      .first<{ c: number }>();
    return row?.c ?? 0;
  }

  const row = await db
    .prepare(
      `SELECT COUNT(*) as c FROM menus
       WHERE user_id = ?
         AND (
           canvas_data LIKE ? ESCAPE '\\'
           OR IFNULL(mobile_document, '') LIKE ? ESCAPE '\\'
           OR IFNULL(menu_document, '') LIKE ? ESCAPE '\\'
           OR IFNULL(thumbnail_url, '') LIKE ? ESCAPE '\\'
           OR IFNULL(export_png_url, '') LIKE ? ESCAPE '\\'
         )`,
    )
    .bind(userId, like, like, like, like, like)
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
