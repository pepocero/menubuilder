-- Plantillas creadas por usuarios y publicación comunitaria
ALTER TABLE templates ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE templates ADD COLUMN is_public INTEGER DEFAULT 0;
ALTER TABLE templates ADD COLUMN created_at TEXT;
ALTER TABLE templates ADD COLUMN updated_at TEXT;

-- Catálogo del sistema: visibles para todos
UPDATE templates SET is_public = 1 WHERE user_id IS NULL;
UPDATE templates SET created_at = datetime('now') WHERE created_at IS NULL;
UPDATE templates SET updated_at = datetime('now') WHERE updated_at IS NULL;
