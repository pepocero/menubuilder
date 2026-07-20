import { useState } from 'react';
import type { FabricObject } from 'fabric';
import { fitImageToA4, isImageObject, isShapeObject, isTextObject, toHexColor } from '@/lib/canvas-serializer';
import type { FabricImage } from 'fabric';

interface PropertiesPanelProps {
  activeObject: FabricObject | null;
  onUpdate: () => void;
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

  const textObj = isTextObject(activeObject) ? (activeObject as FabricObject & {
    text?: string;
    fontFamily?: string;
    fontSize?: number;
    fill?: string;
    textAlign?: string;
  }) : null;

  const fillColor = toHexColor(activeObject.fill, '#cccccc');
  const strokeColor = toHexColor(activeObject.stroke, '#000000');

  return (
    <div className="properties-panel">
      <h3>Propiedades</h3>

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
                textObj.canvas?.requestRenderAll();
                refresh();
              }}
              rows={4}
            />
          </label>
          <label>
            Fuente
            <select
              value={textObj.fontFamily ?? 'Arial'}
              onChange={(e) => updateObject({ fontFamily: e.target.value })}
            >
              <option value="Arial">Arial</option>
              <option value="Georgia">Georgia</option>
              <option value="Playfair Display">Playfair Display</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
              <option value="Verdana">Verdana</option>
            </select>
          </label>
          <label>
            Tamaño
            <input
              type="number"
              min={8}
              max={120}
              value={textObj.fontSize ?? 16}
              onChange={(e) => updateObject({ fontSize: Number(e.target.value) })}
            />
          </label>
          <label>
            Color
            <input
              type="color"
              value={toHexColor(textObj.fill, '#000000')}
              onChange={(e) => updateObject({ fill: e.target.value })}
            />
          </label>
          <label>
            Alineación
            <select
              value={textObj.textAlign ?? 'left'}
              onChange={(e) => updateObject({ textAlign: e.target.value })}
            >
              <option value="left">Izquierda</option>
              <option value="center">Centro</option>
              <option value="right">Derecha</option>
            </select>
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
