-- Soporte de plantillas para cartas móviles
ALTER TABLE templates ADD COLUMN editor_kind TEXT DEFAULT 'canvas';
ALTER TABLE templates ADD COLUMN mobile_document TEXT;

UPDATE templates SET editor_kind = 'canvas' WHERE editor_kind IS NULL;
