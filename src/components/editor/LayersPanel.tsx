import { useEffect, useRef, useState } from 'react';
import type { FabricObject } from 'fabric';
import {
  getLayerDisplayName,
  getLayerObjectData,
  isLayerLocked,
} from '@/lib/layer-utils';

interface LayersPanelProps {
  objects: FabricObject[];
  objectsTick: number;
  activeObject: FabricObject | null;
  onSelect: (obj: FabricObject) => void;
  onMoveUp: (obj: FabricObject) => void;
  onMoveDown: (obj: FabricObject) => void;
  onSendToBack: (obj: FabricObject) => void;
  onToggleVisibility: (obj: FabricObject) => void;
  onToggleLock: (obj: FabricObject) => void;
  onRenameLayer: (obj: FabricObject, name: string) => void;
  onDuplicate: (obj: FabricObject) => void;
  onDelete: (obj: FabricObject) => void;
}

function LockIcon({ locked }: { locked: boolean }) {
  if (locked) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        <path d="M18 10h-1V7a5 5 0 0 0-10 0v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zm-7 0V7a2 2 0 1 1 4 0v3h-4z" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm3 8H9V7a3 3 0 0 1 6 0v3z" />
    </svg>
  );
}

export function LayersPanel({
  objects,
  objectsTick,
  activeObject,
  onSelect,
  onMoveUp,
  onMoveDown,
  onSendToBack,
  onToggleVisibility,
  onToggleLock,
  onRenameLayer,
  onDuplicate,
  onDelete,
}: LayersPanelProps) {
  const reversed = [...objects].reverse();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const activeItemRef = useRef<HTMLLIElement | null>(null);
  void objectsTick;

  useEffect(() => {
    if (!activeObject || !activeItemRef.current) return;
    activeItemRef.current.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    });
  }, [activeObject, objectsTick]);

  function startRename(obj: FabricObject) {
    const key = getLayerObjectData(obj).layerId ?? String(objects.indexOf(obj));
    setEditingKey(key);
    setEditValue(getLayerDisplayName(obj));
  }

  function commitRename(obj: FabricObject) {
    onRenameLayer(obj, editValue);
    setEditingKey(null);
    setEditValue('');
  }

  return (
    <div className="layers-panel">
      <h3>Capas</h3>
      {reversed.length === 0 && <p className="panel-empty">Sin capas</p>}
      <ul className="layers-list">
        {reversed.map((obj, index) => {
          const data = getLayerObjectData(obj);
          const rowKey = data.layerId ?? `layer-${index}`;
          const locked = isLayerLocked(obj);
          const isEditing = editingKey === rowKey;
          const isActive = activeObject === obj;

          return (
            <li
              key={rowKey}
              ref={isActive ? activeItemRef : undefined}
              className={`layer-item${isActive ? ' active' : ''}`}
            >
              {isEditing ? (
                <input
                  className="layer-rename-input"
                  value={editValue}
                  autoFocus
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitRename(obj)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(obj);
                    if (e.key === 'Escape') setEditingKey(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="layer-name"
                  onClick={() => onSelect(obj)}
                  onDoubleClick={() => startRename(obj)}
                  title="Doble clic para renombrar"
                >
                  {obj.visible === false ? '👁‍🗨' : '👁'} {getLayerDisplayName(obj)}
                </button>
              )}
              <div className="layer-actions">
                <button type="button" title="Renombrar" onClick={() => startRename(obj)}>
                  ✎
                </button>
                <button type="button" title="Subir" onClick={() => onMoveUp(obj)}>
                  ↑
                </button>
                <button type="button" title="Bajar" onClick={() => onMoveDown(obj)}>
                  ↓
                </button>
                <button type="button" title="Enviar al fondo" onClick={() => onSendToBack(obj)}>
                  ⤓
                </button>
                <button type="button" title="Visibilidad" onClick={() => onToggleVisibility(obj)}>
                  {obj.visible === false ? 'Mostrar' : 'Ocultar'}
                </button>
                <button
                  type="button"
                  className={locked ? 'layer-lock-btn is-locked' : 'layer-lock-btn'}
                  title={locked ? 'Desbloquear capa' : 'Bloquear capa'}
                  onClick={() => onToggleLock(obj)}
                  aria-pressed={locked}
                >
                  <LockIcon locked={locked} />
                </button>
                <button type="button" title="Duplicar" onClick={() => onDuplicate(obj)}>
                  ⧉
                </button>
                <button type="button" title="Eliminar" className="danger" onClick={() => onDelete(obj)}>
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
