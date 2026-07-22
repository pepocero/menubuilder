import { useEffect, useState } from 'react';
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
  getTextFormatState,
  textboxHasSelection,
} from '@/lib/text-char-styles';
import { FontFamilyPicker } from '@/components/editor/FontFamilyPicker';

interface PropertiesPanelProps {
  activeObject: FabricObject | null;
  selectedTextCount?: number;
  onUpdate: () => void;
  onMergeTexts?: () => void;
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

export function PropertiesPanel({
  activeObject,
  selectedTextCount = 0,
  onUpdate,
  onMergeTexts,
  onSendToBack,
}: PropertiesPanelProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!activeObject || !isTextObject(activeObject)) return;
    const canvas = activeObject.canvas;
    if (!canvas) return;

    const bump = () => setTick((t) => t + 1);
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
   * No borra otros formatos parciales.
   */
  function updateTextStyle(props: Record<string, unknown>) {
    if (!activeObject || !isTextObject(activeObject)) return;
    applyTextStyleProps(asTextbox(activeObject), props);
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

  function handleUnifyFormat() {
    if (!activeObject || !isTextObject(activeObject)) return;
    refreshTextboxLayout(activeObject, { clearCharStyles: true });
    activeObject.canvas?.requestRenderAll();
    refresh();
  }

  const layerData = getLayerObjectData(activeObject);
  const layerName = layerData.layerName ?? '';

  const textObj = isTextObject(activeObject) ? asTextbox(activeObject) : null;

  const fillColor = toHexColor(activeObject.fill, '#cccccc');
  const strokeColor = toHexColor(activeObject.stroke, '#000000');
  const mixedStyles = textObj ? hasCharacterStyles(activeObject) : false;
  const formatState = textObj
    ? getTextFormatState(textObj)
    : { bold: false, italic: false };
  const isBold = formatState.bold;
  const isItalic = formatState.italic;
  const hasPartialSelection = textObj ? textboxHasSelection(textObj) : false;

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
          {hasPartialSelection && (
            <p className="panel-hint properties-selection-hint">
              Hay texto seleccionado en el lienzo: negrita, cursiva, fuente, tamaño y color se
              aplican solo a esa porción.
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
            <input
              type="number"
              min={8}
              max={120}
              step={1}
              value={Math.round(Number(textObj.fontSize) || 16)}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next)) return;
                updateTextStyle({ fontSize: Math.max(8, Math.min(120, next)) });
              }}
            />
          </label>
          <label onMouseDown={preserveTextSelection}>
            Color
            <input
              type="color"
              value={toHexColor(textObj.fill, '#000000')}
              onChange={(e) => updateTextStyle({ fill: e.target.value })}
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
