import type { FabricObject } from 'fabric';

export interface LayerObjectData {
  layerId?: string;
  layerType?: string;
  layerName?: string;
  locked?: boolean;
  src?: string;
  shape?: string;
}

export function getLayerObjectData(obj: FabricObject): LayerObjectData {
  return ((obj as FabricObject & { data?: LayerObjectData }).data) ?? {};
}

export function setLayerObjectData(obj: FabricObject, patch: Partial<LayerObjectData>): void {
  const current = getLayerObjectData(obj);
  (obj as FabricObject & { data?: LayerObjectData }).data = { ...current, ...patch };
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
