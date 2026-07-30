import { useEffect, useRef, useState } from 'react';
import type { Canvas, FabricImage, FabricObject, Textbox } from 'fabric';
import { fitImageToA4, isImageObject, isShapeObject, isTextObject, refreshTextboxLayout, toHexColor } from '@/lib/canvas-serializer';
import { ensureEditorFontLoaded } from '@/lib/google-fonts';
import { getLayerDisplayName, getLayerObjectData, setLayerObjectData } from '@/lib/layer-utils';
import {
  applyStyleToSelectedTextLayers,
  getSharedSelectedTextStyle,
} from '@/lib/merge-text-layers';
import {
  applyTextStyleProps,
  getActiveFontSizeInfo,
  getTextFormatState,
  textboxHasSelection,
} from '@/lib/text-char-styles';
import { getTextListState, indentTextLines, toggleTextList } from '@/lib/text-list';
import {
  DEFAULT_TEXT_BORDER,
  readTextboxBorder,
  syncTextboxBorder,
  type TextBorder,
  type TextBorderLineStyle,
} from '@/lib/text-border';
import { FontFamilyPicker } from '@/components/editor/FontFamilyPicker';
import { MenuLineProperties } from '@/components/editor/MenuLineProperties';
import { isMenuLineGroup } from '@/lib/menu-line';
import type { Group } from 'fabric';

interface PropertiesPanelProps {
  activeObject: FabricObject | null;
  selectedTextCount?: number;
  pageIndex?: number;
  pageCount?: number;
  canPasteLayer?: boolean;
  onCopyLayer?: () => void;
  onPasteLayer?: () => void;
  onMoveToPrevPage?: () => void;
  onMoveToNextPage?: () => void;
  onUpdate: () => void;
  onMergeTexts?: () => void;
  onConvertTextToMenuLine?: () => void;
  onSendToBack?: () => void;
}

function asTextbox(obj: FabricObject): Textbox {
  return obj as Textbox;
}

/** Estilos por carácter (negrita parcial, pegados, etc.). */
function hasCharacterStyles(obj: FabricObject): boolean {
  const styles = asTextbox(obj).styles;
  if (!styles || typeof styles !== 'object') return false;
  return Object.keys(styles).length > 0;
}

/** Evita que botones roben el foco del texto en edición; no bloquea inputs. */
function preserveTextSelection(e: React.MouseEvent) {
  const el = e.target as HTMLElement;
  if (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  ) {
    return;
  }
  e.preventDefault();
}

function CopyLayerIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.2" />
      <path d="M10.5 5.5V4.2A1.2 1.2 0 0 0 9.3 3H4.2A1.2 1.2 0 0 0 3 4.2v5.1A1.2 1.2 0 0 0 4.2 10.5H5.5" />
    </svg>
  );
}

function PasteLayerIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 3.5h4a1 1 0 0 1 1 1V5h1.2A1.3 1.3 0 0 1 13.5 6.3v6.4A1.3 1.3 0 0 1 12.2 14H3.8A1.3 1.3 0 0 1 2.5 12.7V6.3A1.3 1.3 0 0 1 3.8 5H5V4.5a1 1 0 0 1 1-1Z" />
      <path d="M6 5h4V4.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5V5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BulletListIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="3" cy="4" r="1.2" fill="currentColor" />
      <circle cx="3" cy="8" r="1.2" fill="currentColor" />
      <circle cx="3" cy="12" r="1.2" fill="currentColor" />
      <path fill="currentColor" d="M6 3.2h8v1.5H6V3.2zm0 4h8v1.5H6V7.2zm0 4h8v1.5H6v-1.5z" />
    </svg>
  );
}

function NumberListIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M2.2 2.5h1.2v2.2H2.2V2.5zm0 4.2h1.8v.8H3l.9 1.4v.7H2.2v-.8h.9l-.9-1.3v-.8zm.1 3.8h1v.35c0 .25-.1.4-.35.4s-.35-.15-.35-.4H1.4c0 .85.55 1.35 1.45 1.35S4.3 12.5 4.3 11.7v-.35c0-.55-.35-.9-.9-1 .4-.1.7-.4.7-.9 0-.65-.5-1.15-1.25-1.15S1.4 9.15 1.4 9.8h1c0-.25.15-.4.4-.4s.35.15.35.4-.15.4-.4.4H2.3v.75zM6 3.2h8v1.5H6V3.2zm0 4h8v1.5H6V7.2zm0 4h8v1.5H6v-1.5z"
      />
    </svg>
  );
}

function IndentIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M1 2.5h14v1.5H1V2.5zm6 3.5h8v1.5H7V6zm0 3.5h8v1.5H7V9.5zM1 13h14v1.5H1V13z" />
      <path fill="currentColor" d="M1.2 7.2h3.2v1.6H1.2V7.2zm3.2.8L2.2 6.4v3.2L4.4 8z" />
    </svg>
  );
}

function OutdentIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M1 2.5h14v1.5H1V2.5zm6 3.5h8v1.5H7V6zm0 3.5h8v1.5H7V9.5zM1 13h14v1.5H1V13z" />
      <path fill="currentColor" d="M4.4 7.2H1.2v1.6h3.2V7.2zM1.2 8l2.2 1.6V6.4L1.2 8z" />
    </svg>
  );
}

export function PropertiesPanel({
  activeObject,
  selectedTextCount = 0,
  pageIndex = 0,
  pageCount = 1,
  canPasteLayer = false,
  onCopyLayer,
  onPasteLayer,
  onMoveToPrevPage,
  onMoveToNextPage,
  onUpdate,
  onMergeTexts,
  onConvertTextToMenuLine,
  onSendToBack,
}: PropertiesPanelProps) {
  const [, setTick] = useState(0);
  /** Rango de texto seleccionado en el lienzo (sobrevive al foco del input Tamaño). */
  const textSelectionRef = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    textSelectionRef.current = null;
  }, [activeObject]);

  useEffect(() => {
    if (!activeObject || !isTextObject(activeObject)) return;
    const canvas = activeObject.canvas;
    if (!canvas) return;

    const bump = () => {
      const text = asTextbox(activeObject);
      if (text.isEditing) {
        // Guarda caret o selección para el panel (tamaño al cursor / rango).
        textSelectionRef.current = {
          start: text.selectionStart ?? 0,
          end: text.selectionEnd ?? 0,
        };
      }
      setTick((t) => t + 1);
    };
    canvas.on('text:selection:changed', bump);
    canvas.on('text:editing:entered', bump);
    canvas.on('text:editing:exited', bump);
    return () => {
      canvas.off('text:selection:changed', bump);
      canvas.off('text:editing:entered', bump);
      canvas.off('text:editing:exited', bump);
    };
  }, [activeObject]);

  if (!activeObject) {
    return (
      <div className="properties-panel">
        <h3>Propiedades</h3>
        <p className="panel-empty">Selecciona una capa para editar sus propiedades.</p>
        {(onPasteLayer || onCopyLayer) && (
          <div className="properties-page-transfer" role="group" aria-label="Copiar y pegar capa">
            <div className="properties-page-transfer-row properties-page-transfer-row--icons">
              <button
                type="button"
                className="btn-secondary properties-icon-btn"
                disabled
                title="Selecciona una capa para copiarla"
                aria-label="Copiar capa"
              >
                <CopyLayerIcon />
              </button>
              <button
                type="button"
                className="btn-secondary properties-icon-btn"
                disabled={!onPasteLayer || !canPasteLayer}
                title="Pegar en esta página (Ctrl+V)"
                aria-label="Pegar capa"
                onClick={() => onPasteLayer?.()}
              >
                <PasteLayerIcon />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isMenuLineGroup(activeObject)) {
    const group = activeObject as Group;
    const layerData = getLayerObjectData(group);
    const layerName = layerData.layerName ?? '';

    function refreshMenuLine() {
      setTick((t) => t + 1);
      onUpdate();
    }

    function updateMenuLineObject(props: Record<string, unknown>) {
      group.set(props);
      group.setCoords();
      group.canvas?.requestRenderAll();
      refreshMenuLine();
    }

    return (
      <div className="properties-panel">
        <h3>Línea de carta</h3>

        <label>
          Nombre de capa
          <input
            type="text"
            value={layerName}
            placeholder={getLayerDisplayName(group)}
            onChange={(e) => {
              setLayerObjectData(group, { layerName: e.target.value.trim() || undefined });
              refreshMenuLine();
            }}
          />
        </label>

        <label>
          X
          <input
            type="number"
            value={Math.round(group.left ?? 0)}
            onChange={(e) => updateMenuLineObject({ left: Number(e.target.value) })}
          />
        </label>
        <label>
          Y
          <input
            type="number"
            value={Math.round(group.top ?? 0)}
            onChange={(e) => updateMenuLineObject({ top: Number(e.target.value) })}
          />
        </label>
        <label>
          Opacidad
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={group.opacity ?? 1}
            onChange={(e) => updateMenuLineObject({ opacity: Number(e.target.value) })}
          />
        </label>

        <MenuLineProperties group={group} onUpdate={onUpdate} />

        {(onCopyLayer || onPasteLayer) && (
          <div className="properties-page-transfer" role="group" aria-label="Copiar y pegar capa">
            <div className="properties-page-transfer-row properties-page-transfer-row--icons">
              <button
                type="button"
                className="btn-secondary properties-icon-btn"
                disabled={!onCopyLayer}
                title="Copiar línea de carta"
                aria-label="Copiar capa"
                onClick={() => onCopyLayer?.()}
              >
                <CopyLayerIcon />
              </button>
              <button
                type="button"
                className="btn-secondary properties-icon-btn"
                disabled={!onPasteLayer || !canPasteLayer}
                title="Pegar en esta página (Ctrl+V)"
                aria-label="Pegar capa"
                onClick={() => onPasteLayer?.()}
              >
                <PasteLayerIcon />
              </button>
            </div>
          </div>
        )}

        {(onMoveToPrevPage || onMoveToNextPage) && (
          <div className="properties-page-transfer" role="group" aria-label="Mover de página">
            <button
              type="button"
              className="btn-secondary"
              disabled={!onMoveToPrevPage || pageIndex <= 0}
              onClick={() => onMoveToPrevPage?.()}
            >
              ← Página anterior
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={!onMoveToNextPage || pageIndex >= pageCount - 1}
              onClick={() => onMoveToNextPage?.()}
            >
              Página siguiente →
            </button>
          </div>
        )}

        {onSendToBack && (
          <button type="button" className="btn-secondary" onClick={onSendToBack}>
            Enviar al fondo
          </button>
        )}
      </div>
    );
  }

  if (selectedTextCount >= 2) {
    const canvas = (activeObject.canvas as Canvas | null) ?? null;
    const shared = getSharedSelectedTextStyle(canvas);

    function applyToAll(props: Record<string, unknown>) {
      applyStyleToSelectedTextLayers(canvas, props);
      setTick((t) => t + 1);
      onUpdate();
    }

    return (
      <div className="properties-panel">
        <h3>Propiedades</h3>
        <p className="panel-empty">
          {selectedTextCount} capas de texto seleccionadas. Los cambios de fuente y tamaño se
          aplican a todas.
        </p>

        <label>
          Fuente
          <FontFamilyPicker
            value={shared.fontFamily ?? ''}
            onChange={(fontFamily) => {
              ensureEditorFontLoaded(fontFamily);
              applyToAll({ fontFamily });
            }}
          />
        </label>
        {!shared.fontFamily && (
          <p className="panel-hint">Varias fuentes distintas — elige una para unificarlas.</p>
        )}

        <label>
          Tamaño
          <input
            type="number"
            min={8}
            max={120}
            step={1}
            placeholder={shared.fontSize == null ? 'Varios' : undefined}
            value={shared.fontSize ?? ''}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isFinite(next)) return;
              applyToAll({ fontSize: Math.max(8, Math.min(120, next)) });
            }}
          />
        </label>
        {shared.fontSize == null && (
          <p className="panel-hint">Varios tamaños — escribe uno para unificarlos.</p>
        )}

        {onMergeTexts && (
          <button type="button" className="btn-primary" onClick={onMergeTexts}>
            Unir textos
          </button>
        )}
      </div>
    );
  }

  function refresh() {
    setTick((t) => t + 1);
    onUpdate();
  }

  function updateObject(props: Record<string, unknown>) {
    if (!activeObject) return;
    activeObject.set(props);
    activeObject.setCoords();
    activeObject.canvas?.requestRenderAll();
    refresh();
  }

  /**
   * Aplica estilo a la selección (si editas con texto marcado) o al cuadro entero.
   * Usa el rango guardado si el panel robó el foco (p. ej. input de tamaño).
   */
  function updateTextStyle(
    props: Record<string, unknown>,
    opts?: { keepPanelFocus?: boolean },
  ) {
    if (!activeObject || !isTextObject(activeObject)) return;
    const text = asTextbox(activeObject);
    const stored = textSelectionRef.current;
    const liveStart = text.selectionStart ?? 0;
    const liveEnd = text.selectionEnd ?? 0;
    const range =
      textboxHasSelection(text)
        ? { start: liveStart, end: liveEnd }
        : stored && stored.end > stored.start
          ? stored
          : null;

    applyTextStyleProps(text, props, range);

    if (range && range.end > range.start) {
      textSelectionRef.current = range;
      if (!opts?.keepPanelFocus) {
        if (!text.isEditing) {
          text.enterEditing();
        }
        text.setSelectionStart(range.start);
        text.setSelectionEnd(range.end);
        text.canvas?.requestRenderAll();
      }
    } else if (text.isEditing || stored) {
      // Conservar caret para seguir mostrando el tamaño en esa posición.
      const caret = text.isEditing
        ? { start: liveStart, end: liveEnd }
        : stored;
      if (caret) textSelectionRef.current = caret;
    }

    refresh();
  }

  /** Alineación siempre a nivel de cuadro. */
  function updateTextAlign(align: 'left' | 'center' | 'right') {
    if (!activeObject || !isTextObject(activeObject)) return;
    activeObject.set({ textAlign: align });
    activeObject.setCoords();
    activeObject.canvas?.requestRenderAll();
    refresh();
  }

  function applyTextList(mode: 'bullet' | 'number') {
    if (!activeObject || !isTextObject(activeObject)) return;
    const text = asTextbox(activeObject);
    const nextRange = toggleTextList(text, mode, textSelectionRef.current);
    textSelectionRef.current = nextRange;
    if (!text.isEditing) {
      text.enterEditing();
    }
    text.setSelectionStart(nextRange.start);
    text.setSelectionEnd(nextRange.end);
    text.canvas?.requestRenderAll();
    refresh();
  }

  function applyTextIndent(direction: 1 | -1) {
    if (!activeObject || !isTextObject(activeObject)) return;
    const text = asTextbox(activeObject);
    const nextRange = indentTextLines(text, direction, textSelectionRef.current);
    textSelectionRef.current = nextRange;
    if (!text.isEditing) {
      text.enterEditing();
    }
    text.setSelectionStart(nextRange.start);
    text.setSelectionEnd(nextRange.end);
    text.canvas?.requestRenderAll();
    refresh();
  }

  function handleUnifyFormat() {
    if (!activeObject || !isTextObject(activeObject)) return;
    refreshTextboxLayout(activeObject, { clearCharStyles: true });
    activeObject.canvas?.requestRenderAll();
    refresh();
  }

  const layerData = getLayerObjectData(activeObject);
  const layerName = layerData.layerName ?? '';

  const textObj = isTextObject(activeObject) ? asTextbox(activeObject) : null;
  const textBorder = textObj ? readTextboxBorder(textObj) : { ...DEFAULT_TEXT_BORDER };

  const fillColor = toHexColor(activeObject.fill, '#cccccc');
  const strokeColor = toHexColor(activeObject.stroke, '#000000');
  const mixedStyles = textObj ? hasCharacterStyles(activeObject) : false;
  const formatState = textObj
    ? getTextFormatState(textObj)
    : { bold: false, italic: false };
  const isBold = formatState.bold;
  const isItalic = formatState.italic;
  const storedSelection = textSelectionRef.current;
  const hasPartialSelection = textObj
    ? textboxHasSelection(textObj) ||
      (!!storedSelection && storedSelection.end > storedSelection.start)
    : false;
  const listState = textObj
    ? getTextListState(textObj, storedSelection)
    : { bullet: false, number: false };
  const fontSizeInfo = textObj
    ? getActiveFontSizeInfo(textObj, storedSelection)
    : null;
  const fontSizeMixed = fontSizeInfo?.mixed ?? false;
  const stepBase = Math.round(fontSizeInfo?.stepBase ?? Number(textObj?.fontSize) ?? 16);
  const displayFontSize =
    fontSizeInfo?.display != null ? Math.round(fontSizeInfo.display) : null;

  return (
    <div className="properties-panel">
      <h3>Propiedades</h3>

      <label>
        Nombre de capa
        <input
          type="text"
          value={layerName}
          placeholder={getLayerDisplayName(activeObject)}
          onChange={(e) => {
            setLayerObjectData(activeObject, { layerName: e.target.value.trim() || undefined });
            refresh();
          }}
        />
      </label>

      <label>
        X
        <input
          type="number"
          value={Math.round(activeObject.left ?? 0)}
          onChange={(e) => updateObject({ left: Number(e.target.value) })}
        />
      </label>
      <label>
        Y
        <input
          type="number"
          value={Math.round(activeObject.top ?? 0)}
          onChange={(e) => updateObject({ top: Number(e.target.value) })}
        />
      </label>
      <label>
        Rotación
        <input
          type="number"
          value={Math.round(activeObject.angle ?? 0)}
          onChange={(e) => updateObject({ angle: Number(e.target.value) })}
        />
      </label>
      <label>
        Opacidad
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={activeObject.opacity ?? 1}
          onChange={(e) => updateObject({ opacity: Number(e.target.value) })}
        />
      </label>

      {onSendToBack && (
        <button
          type="button"
          className="btn-secondary"
          style={{ width: '100%', marginBottom: '0.75rem' }}
          onClick={onSendToBack}
          title="Coloca esta capa detrás de todas las demás"
        >
          Enviar al fondo
        </button>
      )}

      {(onCopyLayer || onPasteLayer) && (
        <div className="properties-page-transfer" role="group" aria-label="Copiar y pegar capa">
          <div className="properties-page-transfer-row properties-page-transfer-row--icons">
            <button
              type="button"
              className="btn-secondary properties-icon-btn"
              disabled={!onCopyLayer || !activeObject}
              title="Copiar capa (Ctrl+C)"
              aria-label="Copiar capa"
              onMouseDown={preserveTextSelection}
              onClick={() => onCopyLayer?.()}
            >
              <CopyLayerIcon />
            </button>
            <button
              type="button"
              className="btn-secondary properties-icon-btn"
              disabled={!onPasteLayer || !canPasteLayer}
              title="Pegar en esta página (Ctrl+V)"
              aria-label="Pegar capa"
              onMouseDown={preserveTextSelection}
              onClick={() => onPasteLayer?.()}
            >
              <PasteLayerIcon />
            </button>
          </div>
        </div>
      )}

      {pageCount > 1 && (onMoveToPrevPage || onMoveToNextPage) && (
        <div className="properties-page-transfer" role="group" aria-label="Mover a otra página">
          <p className="panel-hint" style={{ marginBottom: '0.35rem' }}>
            Mover capa a otra página
          </p>
          <div className="properties-page-transfer-row">
            <button
              type="button"
              className="btn-secondary"
              disabled={!onMoveToPrevPage}
              title={`Mover a la página ${pageIndex}`}
              onMouseDown={preserveTextSelection}
              onClick={() => onMoveToPrevPage?.()}
            >
              ↑ Pág. {pageIndex}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={!onMoveToNextPage}
              title={`Mover a la página ${pageIndex + 2}`}
              onMouseDown={preserveTextSelection}
              onClick={() => onMoveToNextPage?.()}
            >
              ↓ Pág. {pageIndex + 2}
            </button>
          </div>
        </div>
      )}

      {textObj && (
        <>
          <label>
            Texto
            <textarea
              value={textObj.text ?? ''}
              onChange={(e) => {
                textObj.set({ text: e.target.value, dirty: true });
                textObj.initDimensions();
                textObj.setCoords();
                textObj.canvas?.requestRenderAll();
                refresh();
              }}
              rows={4}
            />
          </label>
          {onConvertTextToMenuLine && selectedTextCount === 1 && (
            <button
              type="button"
              className="properties-convert-menu-line"
              onMouseDown={preserveTextSelection}
              onClick={() => onConvertTextToMenuLine()}
              title="Convertir a línea de carta (plato ··· precio por cada fila)"
            >
              → Línea de carta
            </button>
          )}
          {hasPartialSelection && (
            <p className="panel-hint properties-selection-hint">
              Hay texto seleccionado en el lienzo: negrita, cursiva, viñetas, fuente, tamaño y color
              se aplican a esa porción (las listas a las líneas afectadas).
            </p>
          )}
          <label onMouseDown={preserveTextSelection}>
            Fuente
            <FontFamilyPicker
              value={textObj.fontFamily ?? 'Arial'}
              onChange={(fontFamily) => {
                ensureEditorFontLoaded(fontFamily);
                updateTextStyle({ fontFamily });
              }}
            />
          </label>
          <label onMouseDown={preserveTextSelection}>
            Tamaño
            <div className="properties-font-size-row">
              <button
                type="button"
                className="properties-font-size-step"
                title={
                  fontSizeMixed
                    ? `Reducir desde el mínimo (${stepBase})`
                    : hasPartialSelection
                      ? 'Reducir tamaño de la selección'
                      : 'Reducir tamaño'
                }
                onMouseDown={preserveTextSelection}
                onClick={() =>
                  updateTextStyle({
                    fontSize: Math.max(8, Math.min(120, stepBase - 1)),
                  })
                }
              >
                −
              </button>
              <input
                type={fontSizeMixed ? 'text' : 'number'}
                min={8}
                max={120}
                step={1}
                inputMode="numeric"
                value={fontSizeMixed ? '–' : (displayFontSize ?? stepBase)}
                placeholder="–"
                title={
                  fontSizeMixed
                    ? 'Varios tamaños en la selección'
                    : hasPartialSelection
                      ? 'Tamaño de la selección'
                      : 'Tamaño en la posición del cursor / de la capa'
                }
                onFocus={(e) => {
                  if (fontSizeMixed) {
                    e.currentTarget.select();
                  }
                }}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
                  if (raw === '' && fontSizeMixed) return;
                  const next = Number(raw);
                  if (!Number.isFinite(next)) return;
                  updateTextStyle(
                    { fontSize: Math.max(8, Math.min(120, next)) },
                    { keepPanelFocus: true },
                  );
                }}
              />
              <button
                type="button"
                className="properties-font-size-step"
                title={
                  fontSizeMixed
                    ? `Aumentar desde el mínimo (${stepBase})`
                    : hasPartialSelection
                      ? 'Aumentar tamaño de la selección'
                      : 'Aumentar tamaño'
                }
                onMouseDown={preserveTextSelection}
                onClick={() =>
                  updateTextStyle({
                    fontSize: Math.max(8, Math.min(120, stepBase + 1)),
                  })
                }
              >
                +
              </button>
            </div>
            {fontSizeMixed && (
              <p className="panel-hint">
                Varios tamaños en la selección. −/+ parten de {stepBase} (el menor).
              </p>
            )}
          </label>
          <label onMouseDown={preserveTextSelection}>
            Color
            <input
              type="color"
              value={toHexColor(textObj.fill, '#000000')}
              onChange={(e) =>
                updateTextStyle({ fill: e.target.value }, { keepPanelFocus: true })
              }
            />
          </label>
          <div className="properties-text-style-row">
            <button
              type="button"
              className={isBold ? 'is-active' : undefined}
              title={
                hasPartialSelection
                  ? 'Negrita (solo selección)'
                  : 'Negrita (todo el texto de la capa)'
              }
              aria-pressed={isBold}
              onMouseDown={preserveTextSelection}
              onClick={() =>
                updateTextStyle({ fontWeight: isBold ? 'normal' : 'bold' })
              }
            >
              <strong>N</strong>
            </button>
            <button
              type="button"
              className={isItalic ? 'is-active' : undefined}
              title={
                hasPartialSelection
                  ? 'Cursiva (solo selección)'
                  : 'Cursiva (todo el texto de la capa)'
              }
              aria-pressed={isItalic}
              onMouseDown={preserveTextSelection}
              onClick={() =>
                updateTextStyle({ fontStyle: isItalic ? 'normal' : 'italic' })
              }
            >
              <em>C</em>
            </button>
            <button
              type="button"
              className={listState.bullet ? 'is-active' : undefined}
              title={
                hasPartialSelection
                  ? 'Viñetas (líneas de la selección)'
                  : 'Viñetas (todo el texto de la capa)'
              }
              aria-pressed={listState.bullet}
              onMouseDown={preserveTextSelection}
              onClick={() => applyTextList('bullet')}
            >
              <BulletListIcon />
            </button>
            <button
              type="button"
              className={listState.number ? 'is-active' : undefined}
              title={
                hasPartialSelection
                  ? 'Numeración (líneas de la selección)'
                  : 'Numeración (todo el texto de la capa)'
              }
              aria-pressed={listState.number}
              onMouseDown={preserveTextSelection}
              onClick={() => applyTextList('number')}
            >
              <NumberListIcon />
            </button>
            <button
              type="button"
              title={
                hasPartialSelection
                  ? 'Aumentar sangría (selección)'
                  : 'Aumentar sangría'
              }
              aria-label="Aumentar sangría"
              onMouseDown={preserveTextSelection}
              onClick={() => applyTextIndent(1)}
            >
              <IndentIcon />
            </button>
            <button
              type="button"
              title={
                hasPartialSelection
                  ? 'Reducir sangría (selección)'
                  : 'Reducir sangría'
              }
              aria-label="Reducir sangría"
              onMouseDown={preserveTextSelection}
              onClick={() => applyTextIndent(-1)}
            >
              <OutdentIcon />
            </button>
          </div>
          <div className="properties-align-row" role="group" aria-label="Alineación">
            <button
              type="button"
              className={(textObj.textAlign ?? 'left') === 'left' ? 'is-active' : undefined}
              title="Alinear a la izquierda"
              aria-pressed={(textObj.textAlign ?? 'left') === 'left'}
              onClick={() => updateTextAlign('left')}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <rect x="1" y="2" width="14" height="1.5" fill="currentColor" />
                <rect x="1" y="5.5" width="9" height="1.5" fill="currentColor" />
                <rect x="1" y="9" width="14" height="1.5" fill="currentColor" />
                <rect x="1" y="12.5" width="9" height="1.5" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              className={textObj.textAlign === 'center' ? 'is-active' : undefined}
              title="Centrar"
              aria-pressed={textObj.textAlign === 'center'}
              onClick={() => updateTextAlign('center')}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <rect x="1" y="2" width="14" height="1.5" fill="currentColor" />
                <rect x="3.5" y="5.5" width="9" height="1.5" fill="currentColor" />
                <rect x="1" y="9" width="14" height="1.5" fill="currentColor" />
                <rect x="3.5" y="12.5" width="9" height="1.5" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              className={textObj.textAlign === 'right' ? 'is-active' : undefined}
              title="Alinear a la derecha"
              aria-pressed={textObj.textAlign === 'right'}
              onClick={() => updateTextAlign('right')}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <rect x="1" y="2" width="14" height="1.5" fill="currentColor" />
                <rect x="6" y="5.5" width="9" height="1.5" fill="currentColor" />
                <rect x="1" y="9" width="14" height="1.5" fill="currentColor" />
                <rect x="6" y="12.5" width="9" height="1.5" fill="currentColor" />
              </svg>
            </button>
          </div>

          {mixedStyles && (
            <p className="panel-hint properties-mixed-hint">
              Esta capa tiene formatos distintos en partes del texto. Usa «Unificar formato» si
              quieres un solo estilo en todo el cuadro.
            </p>
          )}
          <button
            type="button"
            className="btn-secondary"
            style={{ width: '100%', marginBottom: '0.75rem' }}
            title="Elimina negritas, tamaños y colores distintos por carácter y deja el estilo del cuadro"
            onClick={handleUnifyFormat}
          >
            Unificar formato
          </button>

          <p className="panel-hint" style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }}>
            Borde de la caja
          </p>
          <div className="properties-field">
            <span className="properties-field-label">Estilo</span>
            <div className="properties-border-style-row" role="group" aria-label="Estilo de borde">
              {(
                [
                  { style: 'none', title: 'Ninguno' },
                  { style: 'solid', title: 'Continuo' },
                  { style: 'dashed', title: 'Discontinuo' },
                  { style: 'dotted', title: 'Punteado' },
                ] as const
              ).map(({ style, title }) => (
                <button
                  key={style}
                  type="button"
                  className={textBorder.style === style ? 'is-active' : undefined}
                  title={title}
                  aria-label={title}
                  aria-pressed={textBorder.style === style}
                  onMouseDown={preserveTextSelection}
                  onClick={() => {
                    if (!textObj) return;
                    const next: TextBorder = {
                      ...textBorder,
                      style: style as TextBorderLineStyle,
                      width:
                        style === 'none'
                          ? 0
                          : textBorder.width > 0
                            ? textBorder.width
                            : 1,
                    };
                    syncTextboxBorder(textObj, next);
                    refresh();
                  }}
                >
                  {style === 'none' && (
                    <svg viewBox="0 0 24 16" width="22" height="14" aria-hidden="true">
                      <rect
                        x="1.5"
                        y="1.5"
                        width="21"
                        height="13"
                        rx="1.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.25"
                        strokeDasharray="2 2"
                        opacity="0.35"
                      />
                      <line
                        x1="4"
                        y1="13"
                        x2="20"
                        y2="3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                  {style === 'solid' && (
                    <svg viewBox="0 0 24 16" width="22" height="14" aria-hidden="true">
                      <rect
                        x="1.5"
                        y="1.5"
                        width="21"
                        height="13"
                        rx="1.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                      />
                    </svg>
                  )}
                  {style === 'dashed' && (
                    <svg viewBox="0 0 24 16" width="22" height="14" aria-hidden="true">
                      <rect
                        x="1.5"
                        y="1.5"
                        width="21"
                        height="13"
                        rx="1.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeDasharray="4 2.5"
                      />
                    </svg>
                  )}
                  {style === 'dotted' && (
                    <svg viewBox="0 0 24 16" width="22" height="14" aria-hidden="true">
                      <rect
                        x="1.5"
                        y="1.5"
                        width="21"
                        height="13"
                        rx="1.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeDasharray="1.5 2"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
          <label>
            Color borde
            <input
              type="color"
              value={toHexColor(textBorder.color, '#333333')}
              onChange={(e) => {
                if (!textObj) return;
                syncTextboxBorder(textObj, { ...textBorder, color: e.target.value });
                refresh();
              }}
            />
          </label>
          <label>
            Grosor
            <input
              type="number"
              min={1}
              max={40}
              value={Math.max(1, textBorder.width || 1)}
              onChange={(e) => {
                if (!textObj) return;
                const width = Math.max(1, Number(e.target.value) || 1);
                syncTextboxBorder(textObj, {
                  ...textBorder,
                  style: textBorder.style === 'none' ? 'solid' : textBorder.style,
                  width,
                });
                refresh();
              }}
            />
          </label>
          <label>
            Radio esquinas
            <input
              type="number"
              min={0}
              max={200}
              value={textBorder.radius || 0}
              onChange={(e) => {
                if (!textObj) return;
                syncTextboxBorder(textObj, {
                  ...textBorder,
                  radius: Math.max(0, Number(e.target.value) || 0),
                });
                refresh();
              }}
            />
          </label>
          <label>
            Margen
            <input
              type="number"
              min={0}
              max={80}
              value={textBorder.margin || 0}
              title="Espacio entre el borde y el inicio del texto"
              onChange={(e) => {
                if (!textObj) return;
                syncTextboxBorder(textObj, {
                  ...textBorder,
                  margin: Math.max(0, Number(e.target.value) || 0),
                });
                refresh();
              }}
            />
          </label>
        </>
      )}

      {isShapeObject(activeObject) && (
        <>
          {activeObject.type !== 'line' && (
            <label>
              Relleno
              <input
                type="color"
                value={fillColor}
                onChange={(e) => updateObject({ fill: e.target.value })}
              />
            </label>
          )}
          <label>
            Trazo
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => updateObject({ stroke: e.target.value })}
            />
          </label>
          <label>
            Grosor trazo
            <input
              type="number"
              min={0}
              max={20}
              value={activeObject.strokeWidth ?? 1}
              onChange={(e) => updateObject({ strokeWidth: Number(e.target.value) })}
            />
          </label>
        </>
      )}

      {isImageObject(activeObject) && (
        <>
          <p className="panel-hint">
            Imagen seleccionada. Usa «Ajustar a A4» para llenar el lienzo (formato carta).
          </p>
          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', marginBottom: '0.75rem' }}
            onClick={() => {
              const canvas = activeObject.canvas;
              if (!canvas) return;
              fitImageToA4(activeObject as FabricImage, canvas, 'cover');
              refresh();
            }}
          >
            Ajustar a A4 (cubrir)
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ width: '100%', marginBottom: '0.75rem' }}
            onClick={() => {
              const canvas = activeObject.canvas;
              if (!canvas) return;
              fitImageToA4(activeObject as FabricImage, canvas, 'contain');
              refresh();
            }}
          >
            Ajustar a A4 (contener)
          </button>
        </>
      )}
    </div>
  );
}
