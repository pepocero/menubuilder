import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
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
  onDownloadImage: () => void;
  canFitImage: boolean;
  onMergeTexts: () => void;
  canMergeTexts: boolean;
  onMergeMenuLines: () => void;
  canMergeMenuLines: boolean;
  onConvertTextToMenuLine: () => void;
  canConvertTextToMenuLine: boolean;
  onChangeBackground: (color: string) => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  onSaveAsTemplate: () => void;
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

type MenuId = 'edit' | 'insert' | 'image' | 'page' | 'file';

function ChevronIcon() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M2.1 4.1 6 8l3.9-3.9L8.7 2.9 6 5.6 3.3 2.9z" />
    </svg>
  );
}

function ToolbarDropdown({
  id,
  label,
  openMenu,
  setOpenMenu,
  align = 'start',
  badge,
  children,
}: {
  id: MenuId;
  label: string;
  openMenu: MenuId | null;
  setOpenMenu: (id: MenuId | null) => void;
  align?: 'start' | 'end';
  badge?: string;
  children: ReactNode;
}) {
  const open = openMenu === id;
  return (
    <div className={`toolbar-dropdown${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="toolbar-dropdown-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpenMenu(open ? null : id)}
      >
        <span>{label}</span>
        {badge ? <span className="toolbar-dropdown-badge">{badge}</span> : null}
        <ChevronIcon />
      </button>
      {open && (
        <div
          className={`toolbar-dropdown-panel${align === 'end' ? ' toolbar-dropdown-panel--end' : ''}`}
          role="menu"
        >
          {children}
        </div>
      )}
    </div>
  );
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
  onDownloadImage,
  canFitImage,
  onMergeTexts,
  canMergeTexts,
  onMergeMenuLines,
  canMergeMenuLines,
  onConvertTextToMenuLine,
  canConvertTextToMenuLine,
  onChangeBackground,
  onExportPng,
  onExportPdf,
  onExportJson,
  onImportJson,
  onSaveAsTemplate,
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
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    function onPointerDown(event: PointerEvent) {
      if (!barRef.current?.contains(event.target as Node)) setOpenMenu(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenMenu(null);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu]);

  function runAndClose(action: () => void) {
    action();
    setOpenMenu(null);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && !uploading) onUploadImage(file);
    e.target.value = '';
    setOpenMenu(null);
  }

  function handleJsonImportChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && !uploading) onImportJson(file);
    e.target.value = '';
    setOpenMenu(null);
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
    <div className="toolbar" ref={barRef}>
      <div className="toolbar-group" role="group" aria-label="Modo del lienzo">
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
      </div>

      <div className="toolbar-menubar" role="menubar" aria-label="Menús del editor">
        <ToolbarDropdown id="edit" label="Editar" openMenu={openMenu} setOpenMenu={setOpenMenu}>
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            disabled={!canMergeTexts}
            title="Unir las capas de texto seleccionadas en una sola (orden de arriba a abajo)"
            onClick={() => runAndClose(onMergeTexts)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              ☰
            </span>
            Unir textos
          </button>
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            disabled={!canMergeMenuLines}
            title="Unir las líneas de carta seleccionadas en un solo bloque (orden de arriba a abajo)"
            onClick={() => runAndClose(onMergeMenuLines)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              ☰€
            </span>
            Unir líneas de carta
          </button>
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            disabled={!canConvertTextToMenuLine}
            title="Convertir el texto seleccionado en línea de carta (plato ··· precio por cada fila)"
            onClick={() => runAndClose(onConvertTextToMenuLine)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              <MenuLineConvertIcon />
            </span>
            Convertir a línea de carta
          </button>
          <div className="toolbar-menu-sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item toolbar-menu-item--danger"
            disabled={!canClearCanvas}
            title="Quitar todas las capas de la página activa"
            onClick={() => runAndClose(onClearCanvas)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              ⌫
            </span>
            Limpiar lienzo
          </button>
        </ToolbarDropdown>

        <ToolbarDropdown id="insert" label="Insertar" openMenu={openMenu} setOpenMenu={setOpenMenu}>
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            title="Texto"
            onClick={() => runAndClose(onAddText)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              T
            </span>
            Texto
          </button>
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            title="Línea de carta (plato ··· precio)"
            onClick={() => runAndClose(onAddMenuLine)}
          >
            <span className="toolbar-menu-item-icon toolbar-menu-item-icon--menu-line" aria-hidden="true">
              <img src="/menuico.png" alt="" width={18} height={18} draggable={false} />
            </span>
            Línea de carta
          </button>
          <div className="toolbar-menu-sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            title="Rectángulo"
            onClick={() => runAndClose(onAddRect)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              ▭
            </span>
            Rectángulo
          </button>
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            title="Línea"
            onClick={() => runAndClose(onAddLine)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              ─
            </span>
            Línea
          </button>
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            title="Círculo"
            onClick={() => runAndClose(onAddCircle)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              ○
            </span>
            Círculo
          </button>
        </ToolbarDropdown>

        <ToolbarDropdown id="image" label="Imagen" openMenu={openMenu} setOpenMenu={setOpenMenu}>
          <label
            className={`toolbar-menu-item${uploading ? ' is-disabled' : ''}`}
            role="menuitem"
            title="Subir imagen"
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              ↑
            </span>
            {uploading ? `${uploadProgress.percent}%` : 'Subir'}
            <input type="file" accept="image/*" onChange={handleFileChange} hidden disabled={uploading} />
          </label>
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            disabled={uploading}
            onClick={() => runAndClose(onOpenStock)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              ▦
            </span>
            Stock
          </button>
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item toolbar-menu-item--accent"
            disabled={uploading}
            title="Importar carta desde imagen con OCR"
            onClick={() => runAndClose(onOpenImportMenu)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              ☰
            </span>
            Importar carta
          </button>
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            disabled={uploading}
            title="Ver y eliminar archivos subidos"
            onClick={() => runAndClose(onOpenAssets)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              📁
            </span>
            Archivos
          </button>
          <div className="toolbar-menu-sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            disabled={!canFitImage}
            title="Descargar la imagen seleccionada al ordenador"
            onClick={() => runAndClose(onDownloadImage)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              ↓
            </span>
            Descargar
          </button>
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            disabled={!canFitImage}
            title="Ajustar la imagen seleccionada al tamaño A4 del lienzo"
            onClick={() => runAndClose(onFitImageToA4)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              ▣
            </span>
            Ajustar a A4
          </button>
        </ToolbarDropdown>

        <ToolbarDropdown
          id="page"
          label="Página"
          badge={`${pageIndex + 1}/${pageCount}`}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
        >
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            title="Añadir página A4 debajo"
            onClick={() => runAndClose(onAddPage)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              +
            </span>
            Añadir página
          </button>
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            disabled={!canDeletePage}
            title="Eliminar página activa"
            onClick={() => runAndClose(onDeletePage)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              −
            </span>
            Eliminar página
          </button>
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            disabled={!canMovePageUp}
            title="Subir página activa (antes en el menú)"
            onClick={() => runAndClose(onMovePageUp)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              ↑
            </span>
            Subir página
          </button>
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            disabled={!canMovePageDown}
            title="Bajar página activa (después en el menú)"
            onClick={() => runAndClose(onMovePageDown)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              ↓
            </span>
            Bajar página
          </button>
          <div className="toolbar-menu-sep" role="separator" />
          <label className="toolbar-menu-item toolbar-menu-item--color">
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              <span className="toolbar-menu-swatch" style={{ background: backgroundColor }} />
            </span>
            Color de fondo
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => onChangeBackground(e.target.value)}
              title="Color de fondo de la página activa"
            />
          </label>
        </ToolbarDropdown>

        <ToolbarDropdown
          id="file"
          label="Archivo"
          align="end"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
        >
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            title="Exportar página activa a PNG"
            onClick={() => runAndClose(onExportPng)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              PNG
            </span>
            Exportar PNG
          </button>
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            title="Exportar todas las páginas a PDF"
            onClick={() => runAndClose(onExportPdf)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              PDF
            </span>
            Exportar PDF
          </button>
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            title="Exportar diseño a menu.json"
            onClick={() => runAndClose(onExportJson)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              JSON
            </span>
            Exportar JSON
          </button>
          <label
            className={`toolbar-menu-item${uploading ? ' is-disabled' : ''}`}
            role="menuitem"
            title="Importar menu.json"
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              ↓
            </span>
            Importar JSON
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleJsonImportChange}
              hidden
              disabled={uploading}
            />
          </label>
          <div className="toolbar-menu-sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="toolbar-menu-item"
            title="Guardar el diseño actual como plantilla reutilizable"
            onClick={() => runAndClose(onSaveAsTemplate)}
          >
            <span className="toolbar-menu-item-icon" aria-hidden="true">
              ▤
            </span>
            Guardar como plantilla
          </button>
        </ToolbarDropdown>
      </div>

      {uploadProgress && (
        <div
          className="upload-progress"
          role="status"
          aria-live="polite"
          title={`${phaseLabel}: ${uploadProgress.percent}%`}
        >
          <div className="upload-progress-track">
            <div className="upload-progress-bar" style={{ width: `${uploadProgress.percent}%` }} />
          </div>
          <span className="upload-progress-label">
            {phaseLabel} {uploadProgress.percent}%
          </span>
        </div>
      )}

      <div className="toolbar-group toolbar-right">
        <span className="toolbar-badge" title="Formato del espacio de trabajo">
          A4
        </span>
        <button type="button" className="btn-primary" onClick={onOpenQr}>
          QR / Publicar
        </button>
      </div>
    </div>
  );
}
