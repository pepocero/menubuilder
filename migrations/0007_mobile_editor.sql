-- Editor móvil: soporte de documento HTML/CSS y tipo de editor
ALTER TABLE menus ADD COLUMN editor_kind TEXT NOT NULL DEFAULT 'canvas';
ALTER TABLE menus ADD COLUMN mobile_document TEXT;

-- Asegura valores válidos en filas futuras (sqlite no permite CHECK fácil post-hoc en alter)
CREATE INDEX IF NOT EXISTS idx_menus_user_editor_kind ON menus(user_id, editor_kind);
