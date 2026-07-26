import { useEffect, useRef, useState, type DragEvent } from 'react';
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
  /** Índice Fabric (0 = fondo). La lista visual está invertida. */
  onReorder: (obj: FabricObject, fabricIndex: number) => void;
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

function DragHandleIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true" fill="currentColor">
      <circle cx="3.5" cy="2.5" r="1.25" />
      <circle cx="8.5" cy="2.5" r="1.25" />
      <circle cx="3.5" cy="7" r="1.25" />
      <circle cx="8.5" cy="7" r="1.25" />
      <circle cx="3.5" cy="11.5" r="1.25" />
      <circle cx="8.5" cy="11.5" r="1.25" />
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
  onReorder,
  onToggleVisibility,
  onToggleLock,
  onRenameLayer,
  onDuplicate,
  onDelete,
}: LayersPanelProps) {
  const reversed = [...objects].reverse();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
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
    const idx = reversed.indexOf(obj);
    const layerId = getLayerObjectData(obj).layerId ?? 'layer';
    setEditingKey(`${layerId}-${idx}`);
    setEditValue(getLayerDisplayName(obj));
  }

  function commitRename(obj: FabricObject) {
    onRenameLayer(obj, editValue);
    setEditingKey(null);
    setEditValue('');
  }

  function clearDragState() {
    setDragIndex(null);
    setDropIndex(null);
  }

  function handleDragStart(index: number, e: DragEvent<HTMLElement>) {
    if (editingKey !== null) {
      e.preventDefault();
      return;
    }
    setDragIndex(index);
    setDropIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    const row = e.currentTarget.closest('.layer-item');
    if (row instanceof HTMLElement) {
      e.dataTransfer.setDragImage(row, 16, 16);
    }
  }

  function handleDragOver(index: number, e: DragEvent<HTMLLIElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex === null) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    // Mitad superior → insertar antes; inferior → después.
    let target = e.clientY < midY ? index : index + 1;
    // Ajuste: al arrastrar hacia abajo, el hueco tras quitar el origen baja un índice.
    if (dragIndex < target) target -= 1;
    target = Math.max(0, Math.min(reversed.length - 1, target));
    if (dropIndex !== target) setDropIndex(target);
  }

  function handleDrop(e: DragEvent<HTMLLIElement>) {
    e.preventDefault();
    if (dragIndex === null || dropIndex === null || dragIndex === dropIndex) {
      clearDragState();
      return;
    }
    const obj = reversed[dragIndex];
    if (!obj) {
      clearDragState();
      return;
    }
    // Lista visual (arriba = frente) → índice Fabric (0 = fondo).
    const fabricIndex = reversed.length - 1 - dropIndex;
    clearDragState();
    onReorder(obj, fabricIndex);
  }

  return (
    <div className="layers-panel">
      <h3>Capas</h3>
      {reversed.length === 0 && <p className="panel-empty">Sin capas</p>}
      <ul className="layers-list" onDragLeave={(e) => {
        // Si salimos del listado completo, quitar indicador (no del hijo a hijo).
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setDropIndex(dragIndex);
        }
      }}>
        {reversed.map((obj, index) => {
          const data = getLayerObjectData(obj);
          const rowKey = `${data.layerId ?? 'layer'}-${index}`;
          const locked = isLayerLocked(obj);
          const isEditing = editingKey === rowKey;
          const isActive = activeObject === obj;
          const isDragging = dragIndex === index;
          const isDropTarget = dropIndex === index && dragIndex !== null && dragIndex !== dropIndex;

          return (
            <li
              key={rowKey}
              ref={isActive ? activeItemRef : undefined}
              className={`layer-item${isActive ? ' active' : ''}${isDragging ? ' is-dragging' : ''}${isDropTarget ? ' is-drop-target' : ''}`}
              onDragOver={(e) => handleDragOver(index, e)}
              onDrop={handleDrop}
              onDragEnd={clearDragState}
            >
              <div className="layer-item-main">
                <span
                  className="layer-drag-handle"
                  title="Arrastrar para reordenar"
                  role="button"
                  tabIndex={isEditing ? -1 : 0}
                  aria-label={`Reordenar capa ${getLayerDisplayName(obj)}`}
                  aria-disabled={isEditing}
                  draggable={!isEditing}
                  onDragStart={(e) => handleDragStart(index, e)}
                >
                  <DragHandleIcon />
                </span>
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
                    draggable={false}
                  />
                ) : (
                  <button
                    type="button"
                    className="layer-name"
                    onClick={() => onSelect(obj)}
                    onDoubleClick={() => startRename(obj)}
                    title="Doble clic para renombrar · Arrastra el asa para reordenar"
                    draggable={false}
                  >
                    {obj.visible === false ? '👁‍🗨' : '👁'} {getLayerDisplayName(obj)}
                  </button>
                )}
              </div>
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
