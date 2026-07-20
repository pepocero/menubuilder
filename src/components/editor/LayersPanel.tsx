import type { FabricObject } from 'fabric';

interface LayerObjectData {
  layerId?: string;
  layerType?: string;
  src?: string;
}

function getObjectData(obj: FabricObject): LayerObjectData {
  return ((obj as FabricObject & { data?: LayerObjectData }).data) ?? {};
}

interface LayersPanelProps {
  objects: FabricObject[];
  activeObject: FabricObject | null;
  onSelect: (obj: FabricObject) => void;
  onMoveUp: (obj: FabricObject) => void;
  onMoveDown: (obj: FabricObject) => void;
  onToggleVisibility: (obj: FabricObject) => void;
  onToggleLock: (obj: FabricObject) => void;
  onDuplicate: (obj: FabricObject) => void;
  onDelete: (obj: FabricObject) => void;
}

function getLayerLabel(obj: FabricObject): string {
  const data = getObjectData(obj);
  if (data.layerType === 'text' || obj.type === 'textbox' || obj.type === 'text') {
    return (obj as { text?: string }).text?.slice(0, 24) || 'Texto';
  }
  if (data.layerType === 'image' || obj.type === 'image') return 'Imagen';
  if (data.layerType === 'shape' || obj.type === 'rect' || obj.type === 'circle' || obj.type === 'line') {
    return 'Forma';
  }
  return obj.type ?? 'Capa';
}

export function LayersPanel({
  objects,
  activeObject,
  onSelect,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  onToggleLock,
  onDuplicate,
  onDelete,
}: LayersPanelProps) {
  const reversed = [...objects].reverse();

  return (
    <div className="layers-panel">
      <h3>Capas</h3>
      {reversed.length === 0 && <p className="panel-empty">Sin capas</p>}
      <ul className="layers-list">
        {reversed.map((obj, index) => (
          <li
            key={getObjectData(obj).layerId ?? index}
            className={`layer-item ${activeObject === obj ? 'active' : ''}`}
          >
            <button type="button" className="layer-name" onClick={() => onSelect(obj)}>
              {obj.visible === false ? '👁‍🗨' : '👁'} {getLayerLabel(obj)}
            </button>
            <div className="layer-actions">
              <button type="button" title="Subir" onClick={() => onMoveUp(obj)}>
                ↑
              </button>
              <button type="button" title="Bajar" onClick={() => onMoveDown(obj)}>
                ↓
              </button>
              <button type="button" title="Visibilidad" onClick={() => onToggleVisibility(obj)}>
                {obj.visible === false ? 'Mostrar' : 'Ocultar'}
              </button>
              <button type="button" title="Bloquear" onClick={() => onToggleLock(obj)}>
                {obj.selectable === false ? '🔒' : '🔓'}
              </button>
              <button type="button" title="Duplicar" onClick={() => onDuplicate(obj)}>
                ⧉
              </button>
              <button type="button" title="Eliminar" className="danger" onClick={() => onDelete(obj)}>
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
