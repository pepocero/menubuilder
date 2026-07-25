import type { CanvasInteractionMode } from '@/components/editor/EditorZoomControls';
import { MenuLineConvertIcon } from '@/components/editor/MenuLineToolIcons';

export interface UploadProgressState {
  phase: 'compress' | 'upload' | 'place' | 'ocr' | 'import';
  percent: number;
}

interface ToolbarProps {
  interactionMode: CanvasInteractionMode;
  onInteractionModeChange: (mode: CanvasInteractionMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClearCanvas: () => void;
  canClearCanvas: boolean;
  onAddText: () => void;
  onAddMenuLine: () => void;
  onAddRect: () => void;
  onAddLine: () => void;
  onAddCircle: () => void;
  onUploadImage: (file: File) => void;
  onOpenStock: () => void;
  onOpenImportMenu: () => void;
  onOpenAssets: () => void;
  onFitImageToA4: () => void;
  canFitImage: boolean;
  onMergeTexts: () => void;
  canMergeTexts: boolean;
  onConvertTextToMenuLine: () => void;
  canConvertTextToMenuLine: boolean;
  onChangeBackground: (color: string) => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  onOpenQr: () => void;
  onAddPage: () => void;
  onDeletePage: () => void;
  onMovePageUp: () => void;
  onMovePageDown: () => void;
  canDeletePage: boolean;
  canMovePageUp: boolean;
  canMovePageDown: boolean;
  pageIndex: number;
  pageCount: number;
  backgroundColor: string;
  uploadProgress?: UploadProgressState | null;
}

export function Toolbar({
  interactionMode,
  onInteractionModeChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClearCanvas,
  canClearCanvas,
  onAddText,
  onAddMenuLine,
  onAddRect,
  onAddLine,
  onAddCircle,
  onUploadImage,
  onOpenStock,
  onOpenImportMenu,
  onOpenAssets,
  onFitImageToA4,
  canFitImage,
  onMergeTexts,
  canMergeTexts,
  onConvertTextToMenuLine,
  canConvertTextToMenuLine,
  onChangeBackground,
  onExportPng,
  onExportPdf,
  onExportJson,
  onImportJson,
  onOpenQr,
  onAddPage,
  onDeletePage,
  onMovePageUp,
  onMovePageDown,
  canDeletePage,
  canMovePageUp,
  canMovePageDown,
  pageIndex,
  pageCount,
  backgroundColor,
  uploadProgress = null,
}: ToolbarProps) {
  const uploading = !!uploadProgress;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && !uploading) onUploadImage(file);
    e.target.value = '';
  }

  function handleJsonImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && !uploading) onImportJson(file);
    e.target.value = '';
  }

  const phaseLabel =
    uploadProgress?.phase === 'compress'
      ? 'Comprimiendo'
      : uploadProgress?.phase === 'upload'
        ? 'Subiendo'
        : uploadProgress?.phase === 'place'
          ? 'Añadiendo al lienzo'
          : uploadProgress?.phase === 'ocr'
            ? 'Leyendo carta con IA'
            : uploadProgress?.phase === 'import'
              ? 'Creando capas'
              : '';

  return (
    <div className="toolbar">
      <div className="toolbar-group" role="group" aria-label="Modo del lienzo">
        <span className="toolbar-label">Lienzo</span>
        <button
          type="button"
          className={interactionMode === 'move' ? 'is-active' : undefined}
          title="Mover y editar capas"
          aria-pressed={interactionMode === 'move'}
          onClick={() => onInteractionModeChange('move')}
        >
          Mover
        </button>
        <button
          type="button"
          className={interactionMode === 'scroll' ? 'is-active' : undefined}
          title="Desplazar el lienzo (scroll)"
          aria-pressed={interactionMode === 'scroll'}
          onClick={() => onInteractionModeChange('scroll')}
        >
          Scroll
        </button>
      </div>

      <div className="toolbar-group">
        <span className="toolbar-label">Editar</span>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Deshacer (Ctrl+Z)"
          aria-label="Deshacer"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Rehacer (Ctrl+Y)"
          aria-label="Rehacer"
        >
          ↷
        </button>
        <button
          type="button"
          onClick={onClearCanvas}
          disabled={!canClearCanvas}
          title="Quitar todas las capas de la página activa"
        >
          Limpiar lienzo
        </button>
      </div>

      <div className="toolbar-group">
        <span className="toolbar-label">Añadir</span>
        <button type="button" onClick={onAddText} title="Texto">
          T
        </button>
        <button
          type="button"
          className="toolbar-icon-btn toolbar-icon-btn--menu-line"
          onClick={onAddMenuLine}
          title="Línea de carta (plato ··· precio)"
          aria-label="Añadir línea de carta"
        >
          <img
            src="/menuico.png"
            alt=""
            className="toolbar-menu-line-icon"
            width={24}
            height={24}
            draggable={false}
          />
        </button>
        <button type="button" onClick={onAddRect} title="Rectángulo">
          ▭
        </button>
        <button type="button" onClick={onAddLine} title="Línea">
          ─
        </button>
        <button type="button" onClick={onAddCircle} title="Círculo">
          ○
        </button>
        <button
          type="button"
          onClick={onMergeTexts}
          disabled={!canMergeTexts}
          title="Unir las capas de texto seleccionadas en una sola (orden de arriba a abajo)"
        >
          Unir textos
        </button>
        <button
          type="button"
          className="toolbar-icon-btn"
          onClick={onConvertTextToMenuLine}
          disabled={!canConvertTextToMenuLine}
          title="Convertir el texto seleccionado en línea de carta (plato ··· precio por cada fila)"
          aria-label="Convertir texto a línea de carta"
        >
          <MenuLineConvertIcon />
        </button>
      </div>

      <div className="toolbar-group">
        <span className="toolbar-label">Imagen</span>
        <label className={`btn-file${uploading ? ' btn-file--disabled' : ''}`}>
          {uploading ? `${uploadProgress.percent}%` : 'Subir'}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            hidden
            disabled={uploading}
          />
        </label>
        {uploadProgress && (
          <div
            className="upload-progress"
            role="status"
            aria-live="polite"
            title={`${phaseLabel}: ${uploadProgress.percent}%`}
          >
            <div className="upload-progress-track">
              <div
                className="upload-progress-bar"
                style={{ width: `${uploadProgress.percent}%` }}
              />
            </div>
            <span className="upload-progress-label">
              {phaseLabel} {uploadProgress.percent}%
            </span>
          </div>
        )}
        <button type="button" onClick={onOpenStock} disabled={uploading}>
          Stock
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={onOpenImportMenu}
          disabled={uploading}
          title="Importar carta desde imagen con OCR"
        >
          Importar carta
        </button>
        <button
          type="button"
          onClick={onOpenAssets}
          disabled={uploading}
          title="Ver y eliminar archivos subidos"
        >
          Archivos
        </button>
        <button
          type="button"
          onClick={onFitImageToA4}
          disabled={!canFitImage}
          title="Ajustar la imagen seleccionada al tamaño A4 del lienzo"
        >
          Ajustar a A4
        </button>
      </div>

      <div className="toolbar-group">
        <span className="toolbar-label">Fondo</span>
        <input
          type="color"
          value={backgroundColor}
          onChange={(e) => onChangeBackground(e.target.value)}
          title="Color de fondo de la página activa"
        />
      </div>

      <div className="toolbar-group">
        <span className="toolbar-label">Páginas</span>
        <span className="toolbar-badge" title="Página activa / total">
          {pageIndex + 1}/{pageCount}
        </span>
        <button type="button" onClick={onAddPage} title="Añadir página A4 debajo">
          + Página
        </button>
        <button
          type="button"
          onClick={onDeletePage}
          disabled={!canDeletePage}
          title="Eliminar página activa"
        >
          − Página
        </button>
        <button
          type="button"
          onClick={onMovePageUp}
          disabled={!canMovePageUp}
          title="Subir página activa (antes en el menú)"
        >
          ↑ Página
        </button>
        <button
          type="button"
          onClick={onMovePageDown}
          disabled={!canMovePageDown}
          title="Bajar página activa (después en el menú)"
        >
          ↓ Página
        </button>
      </div>

      <div className="toolbar-group toolbar-right">
        <span className="toolbar-badge" title="Formato del espacio de trabajo">
          A4
        </span>
        <button type="button" onClick={onExportPng} title="Exportar página activa a PNG">
          PNG
        </button>
        <button type="button" onClick={onExportJson} title="Exportar diseño a menu.json">
          Exportar JSON
        </button>
        <label className={`btn-file${uploading ? ' btn-file--disabled' : ''}`} title="Importar menu.json">
          Importar JSON
          <input
            type="file"
            accept="application/json,.json"
            onChange={handleJsonImportChange}
            hidden
            disabled={uploading}
          />
        </label>
        <button type="button" onClick={onExportPdf} title="Exportar todas las páginas a PDF">
          PDF
        </button>
        <button type="button" className="btn-primary" onClick={onOpenQr}>
          QR / Publicar
        </button>
      </div>
    </div>
  );
}
