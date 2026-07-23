import type { FabricObject } from 'fabric';

export interface LayerObjectData {
  layerId?: string;
  layerType?: string;
  layerName?: string;
  locked?: boolean;
  src?: string;
  shape?: string;
  border?: unknown;
}

export function getLayerObjectData(obj: FabricObject): LayerObjectData {
  return ((obj as FabricObject & { data?: LayerObjectData }).data) ?? {};
}

export function setLayerObjectData(obj: FabricObject, patch: Partial<LayerObjectData>): void {
  const current = getLayerObjectData(obj);
  (obj as FabricObject & { data?: LayerObjectData }).data = { ...current, ...patch };
}

/** Corrige layerId duplicados (p. ej. tras copias fallidas entre páginas). */
export function ensureUniqueLayerIds(objects: FabricObject[]): boolean {
  const seen = new Set<string>();
  let changed = false;
  for (const obj of objects) {
    const current = getLayerObjectData(obj).layerId?.trim();
    if (current && !seen.has(current)) {
      seen.add(current);
      continue;
    }
    const nextId = `layer_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
    setLayerObjectData(obj, { layerId: nextId });
    seen.add(nextId);
    changed = true;
  }
  return changed;
}

/** Capa bloqueada: no se puede seleccionar ni mover. */
export function isLayerLocked(obj: FabricObject): boolean {
  const data = getLayerObjectData(obj);
  if (typeof data.locked === 'boolean') return data.locked;
  return obj.selectable === false;
}

export function getLayerDisplayName(obj: FabricObject): string {
  const data = getLayerObjectData(obj);
  if (data.layerName?.trim()) return data.layerName.trim();

  if (data.layerType === 'text' || obj.type === 'textbox' || obj.type === 'text') {
    const text = (obj as { text?: string }).text?.trim();
    if (text) return text.slice(0, 32);
    return 'Texto';
  }
  if (data.layerType === 'image' || obj.type === 'image') return 'Imagen';
  if (data.layerType === 'shape' || obj.type === 'rect' || obj.type === 'circle' || obj.type === 'line') {
    if (data.shape === 'line') return 'Línea';
    if (data.shape === 'circle') return 'Círculo';
    return 'Rectángulo';
  }
  return 'Capa';
}

export function getLayerDefaultName(obj: FabricObject): string {
  const data = getLayerObjectData(obj);
  if (data.layerType === 'text' || obj.type === 'textbox' || obj.type === 'text') return 'Texto';
  if (data.layerType === 'image' || obj.type === 'image') return 'Imagen';
  if (data.layerType === 'shape' || obj.type === 'rect' || obj.type === 'circle' || obj.type === 'line') {
    if (data.shape === 'line') return 'Línea';
    if (data.shape === 'circle') return 'Círculo';
    return 'Rectángulo';
  }
  return 'Capa';
}
