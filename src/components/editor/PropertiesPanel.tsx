import { useState } from 'react';
import type { FabricImage, FabricObject, Textbox } from 'fabric';
import { fitImageToA4, isImageObject, isShapeObject, isTextObject, refreshTextboxLayout, toHexColor } from '@/lib/canvas-serializer';
import { EDITOR_FONTS, ensureEditorFontLoaded } from '@/lib/google-fonts';
import { getLayerDisplayName, getLayerObjectData, setLayerObjectData } from '@/lib/layer-utils';

interface PropertiesPanelProps {
  activeObject: FabricObject | null;
  onUpdate: () => void;
}

function asTextbox(obj: FabricObject): Textbox {
  return obj as Textbox;
}

/** Estilos por carácter (p. ej. tras pegar) que anulan la fuente/tamaño del cuadro. */
function hasCharacterStyles(obj: FabricObject): boolean {
  const styles = asTextbox(obj).styles;
  if (!styles || typeof styles !== 'object') return false;
  return Object.keys(styles).length > 0;
}

export function PropertiesPanel({ activeObject, onUpdate }: PropertiesPanelProps) {
  const [, setTick] = useState(0);

  if (!activeObject) {
    return (
      <div className="properties-panel">
        <h3>Propiedades</h3>
        <p className="panel-empty">Selecciona una capa para editar sus propiedades.</p>
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

  /** Cambia estilo de texto y unifica: elimina overrides por carácter. */
  function updateTextStyle(props: Record<string, unknown>) {
    if (!activeObject || !isTextObject(activeObject)) return;
    activeObject.set(props);
    refreshTextboxLayout(activeObject);
    activeObject.setCoords();
    activeObject.canvas?.requestRenderAll();
    refresh();
  }

  function handleUnifyFormat() {
    if (!activeObject || !isTextObject(activeObject)) return;
    refreshTextboxLayout(activeObject);
    activeObject.canvas?.requestRenderAll();
    refresh();
  }

  const layerData = getLayerObjectData(activeObject);
  const layerName = layerData.layerName ?? '';

  const textObj = isTextObject(activeObject)
    ? (activeObject as FabricObject & {
        text?: string;
        fontFamily?: string;
        fontSize?: number;
        fontWeight?: string | number;
        fontStyle?: string;
        fill?: string;
        textAlign?: string;
      })
    : null;

  const fillColor = toHexColor(activeObject.fill, '#cccccc');
  const strokeColor = toHexColor(activeObject.stroke, '#000000');
  const mixedStyles = textObj ? hasCharacterStyles(activeObject) : false;
  const isBold =
    textObj?.fontWeight === 'bold' ||
    textObj?.fontWeight === '700' ||
    Number(textObj?.fontWeight) >= 600;
  const isItalic = textObj?.fontStyle === 'italic' || textObj?.fontStyle === 'oblique';

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

      {textObj && (
        <>
          <label>
            Texto
            <textarea
              value={textObj.text ?? ''}
              onChange={(e) => {
                textObj.set({ text: e.target.value });
                refreshTextboxLayout(activeObject);
                refresh();
              }}
              rows={4}
            />
          </label>
          <label>
            Fuente
            <select
              value={textObj.fontFamily ?? 'Arial'}
              onChange={(e) => {
                ensureEditorFontLoaded(e.target.value);
                updateTextStyle({ fontFamily: e.target.value });
              }}
            >
              {EDITOR_FONTS.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                  {font.local ? ' (local)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tamaño
            <input
              type="number"
              min={8}
              max={120}
              value={textObj.fontSize ?? 16}
              onChange={(e) => updateTextStyle({ fontSize: Number(e.target.value) })}
            />
          </label>
          <label>
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
              title="Negrita"
              aria-pressed={isBold}
              onClick={() =>
                updateTextStyle({ fontWeight: isBold ? 'normal' : 'bold' })
              }
            >
              <strong>N</strong>
            </button>
            <button
              type="button"
              className={isItalic ? 'is-active' : undefined}
              title="Cursiva"
              aria-pressed={isItalic}
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
              onClick={() => updateTextStyle({ textAlign: 'left' })}
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
              onClick={() => updateTextStyle({ textAlign: 'center' })}
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
              onClick={() => updateTextStyle({ textAlign: 'right' })}
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
              Este cuadro tiene formatos mezclados (p. ej. tras pegar texto). Usa «Unificar formato»
              o cambia fuente/tamaño para aplicar un solo estilo a todo.
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
