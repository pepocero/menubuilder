import { Canvas, type Group } from 'fabric';
import { getLayerObjectData, setLayerObjectData } from '@/lib/layer-utils';
import {
  isMenuLineGroup,
  menuLineGroupToLayer,
  menuLineLayerToGroup,
} from '@/lib/menu-line';
import type { MenuLineLayer, MenuLineRow } from '@/types/canvas';

/** Capas «línea de carta» incluidas en la selección activa. */
export function getSelectedMenuLineGroups(canvas: Canvas | null): Group[] {
  if (!canvas) return [];
  return canvas.getActiveObjects().filter(isMenuLineGroup) as Group[];
}

/** Al menos 2 líneas de carta y la selección no mezcla otros tipos. */
export function canMergeSelectedMenuLines(canvas: Canvas | null): boolean {
  if (!canvas) return false;
  const active = canvas.getActiveObjects();
  if (active.length < 2) return false;
  return active.every(isMenuLineGroup);
}

function cloneRow(row: MenuLineRow): MenuLineRow {
  return JSON.parse(JSON.stringify(row)) as MenuLineRow;
}

/** Posición en el lienzo (absoluta), no relativa a ActiveSelection. */
function sceneLeftTop(group: Group): { left: number; top: number } {
  return {
    left: group.left ?? 0,
    top: group.top ?? 0,
  };
}

/**
 * Une las líneas de carta seleccionadas en un solo bloque
 * (orden de arriba a abajo; a igual altura, de izquierda a derecha).
 */
export function mergeSelectedMenuLines(canvas: Canvas): Group | null {
  if (!canMergeSelectedMenuLines(canvas)) return null;

  const groups = getSelectedMenuLineGroups(canvas);
  if (groups.length < 2) return null;

  // En ActiveSelection los hijos tienen left/top relativos al grupo de selección.
  // Hay que soltarlos antes de leer la posición real en el lienzo.
  canvas.discardActiveObject();

  const sorted = [...groups].sort((a, b) => {
    const pa = sceneLeftTop(a);
    const pb = sceneLeftTop(b);
    if (Math.abs(pa.top - pb.top) > 2) return pa.top - pb.top;
    return pa.left - pb.left;
  });

  const layers: MenuLineLayer[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const layer = menuLineGroupToLayer(sorted[i], i + 1);
    if (!layer || layer.rows.length === 0) continue;
    layers.push(layer);
  }
  if (layers.length < 2) return null;

  const first = layers[0];
  const rows = layers.flatMap((layer) => layer.rows.map(cloneRow));
  const width = Math.max(...layers.map((l) => l.width || 0), first.width || 0);
  const left = Math.min(...sorted.map((g) => sceneLeftTop(g).left));
  const top = Math.min(...sorted.map((g) => sceneLeftTop(g).top));

  const firstData = getLayerObjectData(sorted[0]);
  const mergedLayer: MenuLineLayer = {
    id: `layer_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
    type: 'menuLine',
    name: firstData.layerName?.trim() || first.name || 'Línea de carta',
    x: left,
    y: top,
    width,
    height: first.height || 1,
    rotation: 0,
    zIndex: first.zIndex,
    visible: true,
    locked: false,
    opacity: first.opacity ?? 1,
    leader: first.leader,
    leftWidth: first.leftWidth,
    columnRatios: { ...first.columnRatios },
    rows,
    rowGap: first.rowGap,
  };

  for (const g of sorted) {
    canvas.remove(g);
  }

  const group = menuLineLayerToGroup(mergedLayer);
  setLayerObjectData(group, {
    layerId: mergedLayer.id,
    layerType: 'menuLine',
    layerName: mergedLayer.name,
  });
  // Reafirmar posición tras el layout interno (evita saltos al origen).
  group.set({ left, top });
  group.setCoords();
  canvas.add(group);
  canvas.setActiveObject(group);
  canvas.requestRenderAll();
  return group;
}
