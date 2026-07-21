-- Documento exportable (JSON versionado) y PNG de exportación en R2
ALTER TABLE menus ADD COLUMN menu_document TEXT;
ALTER TABLE menus ADD COLUMN export_png_url TEXT;
