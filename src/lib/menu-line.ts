import { Group, Textbox, type Canvas, type FabricObject } from 'fabric';
import type {
  MenuLineCell,
  MenuLineColumn,
  MenuLineColumnKey,
  MenuLineColumnRatios,
  MenuLineColumnStyle,
  MenuLineLayer,
  MenuLineLeader,
  MenuLineRow,
} from '@/types/canvas';
import { setLayerObjectData, getLayerObjectData } from '@/lib/layer-utils';

export const MENU_LINE_COLUMN_KEYS: MenuLineColumnKey[] = ['left', 'center', 'right'];
export const MENU_LINE_DEFAULT_ROW_GAP = 6;

export const MENU_LINE_LEADER_OPTIONS: ReadonlyArray<{
  value: MenuLineLeader;
  label: string;
}> = [
  { value: 'dots', label: 'Puntos (····)' },
  { value: 'dashes', label: 'Guiones (––––)' },
  { value: 'spaces', label: 'Espacios' },
  { value: 'custom', label: 'Personalizado' },
];

const COLUMN_LABELS: Record<MenuLineColumnKey, string> = {
  left: 'Plato',
  center: 'Separador',
  right: 'Precio',
};

export function menuLineColumnLabel(key: MenuLineColumnKey): string {
  return COLUMN_LABELS[key];
}

function defaultColumnStyle(
  partial?: Partial<MenuLineColumnStyle>,
): MenuLineColumnStyle {
  return {
    fontFamily: 'Arial',
    fontSize: 18,
    color: '#333333',
    align: 'left',
    fontWeight: 'normal',
    fontStyle: 'normal',
    ...partial,
  };
}

function normalizeRatio(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.min(0.85, Math.max(0.08, value));
}

function normalizeLeader(value: unknown): MenuLineLeader {
  if (value === 'dashes' || value === 'spaces' || value === 'custom' || value === 'dots') {
    return value;
  }
  return 'dots';
}

function normalizeColumnStyle(
  raw: unknown,
  fallback: MenuLineColumnStyle,
): MenuLineColumnStyle {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const align =
    s.align === 'center' || s.align === 'right' || s.align === 'left'
      ? s.align
      : fallback.align;
  return {
    fontFamily:
      typeof s.fontFamily === 'string' && s.fontFamily.trim()
        ? s.fontFamily
        : fallback.fontFamily,
    fontSize:
      typeof s.fontSize === 'number' && Number.isFinite(s.fontSize) && s.fontSize > 0
        ? Math.round(s.fontSize)
        : fallback.fontSize,
    color: typeof s.color === 'string' && s.color ? s.color : fallback.color,
    align,
    fontWeight: typeof s.fontWeight === 'string' ? s.fontWeight : fallback.fontWeight,
    fontStyle: typeof s.fontStyle === 'string' ? s.fontStyle : fallback.fontStyle,
  };
}

function normalizeCell(raw: unknown, fallback: MenuLineCell): MenuLineCell {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    content: typeof c.content === 'string' ? c.content : fallback.content,
    style: normalizeColumnStyle(c.style, fallback.style),
  };
}

export function normalizeColumnRatios(
  ratios: Partial<MenuLineColumnRatios> | undefined,
  fromColumns?: MenuLineLayer['columns'],
): MenuLineColumnRatios {
  const left = normalizeRatio(
    ratios?.left ?? fromColumns?.left.widthRatio,
    0.48,
  );
  const center = normalizeRatio(
    ratios?.center ?? fromColumns?.center.widthRatio,
    0.32,
  );
  const right = normalizeRatio(
    ratios?.right ?? fromColumns?.right.widthRatio,
    0.2,
  );
  const sum = left + center + right;
  return { left: left / sum, center: center / sum, right: right / sum };
}

function defaultRowTemplate(): MenuLineRow {
  return {
    left: {
      content: 'Nombre del plato',
      style: defaultColumnStyle({ align: 'left', fontWeight: 'normal' }),
    },
    center: {
      content: '',
      style: defaultColumnStyle({
        align: 'center',
        color: '#888888',
        fontSize: 16,
      }),
    },
    right: {
      content: '0,00 €',
      style: defaultColumnStyle({
        align: 'right',
        fontWeight: 'bold',
      }),
    },
  };
}

function rowFromLegacyColumns(columns: {
  left: MenuLineColumn;
  center: MenuLineColumn;
  right: MenuLineColumn;
}): MenuLineRow {
  return {
    left: { content: columns.left.content, style: columns.left.style },
    center: { content: columns.center.content, style: columns.center.style },
    right: { content: columns.right.content, style: columns.right.style },
  };
}

function cloneRowAsTemplate(row: MenuLineRow): MenuLineRow {
  return {
    left: {
      content: 'Nombre del plato',
      style: { ...row.left.style },
    },
    center: {
      content: '',
      style: { ...row.center.style },
    },
    right: {
      content: '0,00 €',
      style: { ...row.right.style },
    },
    leader: row.leader,
  };
}

/** Normaliza capa (legacy `columns` → `rows` + `columnRatios`). */
export function normalizeMenuLineLayerData(
  layer: MenuLineLayer,
): Omit<MenuLineLayer, 'columns'> & { columns?: undefined } {
  const template = defaultRowTemplate();
  let rows: MenuLineRow[] = [];

  if (Array.isArray(layer.rows) && layer.rows.length > 0) {
    rows = layer.rows.map((row) => ({
      left: normalizeCell(row?.left, template.left),
      center: normalizeCell(row?.center, template.center),
      right: normalizeCell(row?.right, template.right),
      leader: row?.leader ? normalizeLeader(row.leader) : undefined,
    }));
  } else if (layer.columns) {
    rows = [rowFromLegacyColumns(layer.columns)];
  } else {
    rows = [template];
  }

  return {
    ...layer,
    leader: normalizeLeader(layer.leader),
    columnRatios: normalizeColumnRatios(layer.columnRatios, layer.columns),
    rows,
    rowGap:
      typeof layer.rowGap === 'number' && Number.isFinite(layer.rowGap) && layer.rowGap >= 0
        ? layer.rowGap
        : MENU_LINE_DEFAULT_ROW_GAP,
    columns: undefined,
  };
}

/** @deprecated usar normalizeColumnRatios; se mantiene por compat de imports. */
export function normalizeMenuLineRatios(columns: {
  left: MenuLineColumn;
  center: MenuLineColumn;
  right: MenuLineColumn;
}): {
  left: MenuLineColumn;
  center: MenuLineColumn;
  right: MenuLineColumn;
} {
  const ratios = normalizeColumnRatios(undefined, columns);
  return {
    left: { ...columns.left, widthRatio: ratios.left },
    center: { ...columns.center, widthRatio: ratios.center },
    right: { ...columns.right, widthRatio: ratios.right },
  };
}

export function createMenuLineLayer(x = 48, y = 120, totalWidth = 500): MenuLineLayer {
  const row = defaultRowTemplate();
  return {
    id: `layer_${crypto.randomUUID().slice(0, 8)}`,
    type: 'menuLine',
    name: 'Línea de carta',
    x,
    y,
    width: totalWidth,
    height: 28,
    rotation: 0,
    zIndex: 1,
    leader: 'dots',
    columnRatios: { left: 0.48, center: 0.32, right: 0.2 },
    rows: [row],
    rowGap: MENU_LINE_DEFAULT_ROW_GAP,
  };
}

export function isMenuLineGroup(obj: FabricObject | null | undefined): obj is Group {
  if (!obj || obj.type !== 'group') return false;
  const data = getLayerObjectData(obj);
  if (data.layerType === 'menuLine') return true;
  if (!(obj instanceof Group)) return false;
  const kids = obj.getObjects();
  if (kids.length < 3 || kids.length % 3 !== 0) return false;
  return kids.every((child) => {
    const role = getLayerObjectData(child).menuLineRole;
    return role === 'left' || role === 'center' || role === 'right';
  });
}

export function getMenuLineRowCount(group: Group): number {
  const kids = group.getObjects().filter((c) => c instanceof Textbox);
  return Math.max(1, Math.floor(kids.length / 3));
}

export function getMenuLineColumn(
  group: Group,
  key: MenuLineColumnKey,
  rowIndex = 0,
): Textbox | null {
  for (const child of group.getObjects()) {
    if (!(child instanceof Textbox)) continue;
    const data = getLayerObjectData(child);
    const idx = typeof data.menuLineRowIndex === 'number' ? data.menuLineRowIndex : 0;
    if (data.menuLineRole === key && idx === rowIndex) return child;
  }
  // Compat grupos antiguos sin índice: primera coincidencia de rol
  if (rowIndex === 0) {
    for (const child of group.getObjects()) {
      if (
        child instanceof Textbox &&
        getLayerObjectData(child).menuLineRole === key
      ) {
        return child;
      }
    }
  }
  return null;
}

function leaderChar(leader: MenuLineLeader): string {
  if (leader === 'dashes') return '–';
  if (leader === 'spaces') return '\u00A0';
  return '·';
}

export function buildLeaderContent(
  leader: MenuLineLeader,
  columnWidth: number,
  style: MenuLineColumnStyle,
  customContent = '',
): string {
  if (leader === 'custom') return customContent;

  const ch = leaderChar(leader);
  const probe = new Textbox(ch.repeat(20), {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight ?? 'normal',
    fontStyle:
      style.fontStyle === 'italic' || style.fontStyle === 'oblique'
        ? style.fontStyle
        : 'normal',
    width: 10_000,
  });
  probe.initDimensions();
  const measured = probe.calcTextWidth();
  const unit = measured > 0 ? measured / 20 : Math.max(4, style.fontSize * 0.45);
  const count = Math.max(1, Math.floor(Math.max(0, columnWidth - 4) / unit));
  return ch.repeat(count);
}

function applyColumnStyle(box: Textbox, style: MenuLineColumnStyle): void {
  box.set({
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fill: style.color,
    textAlign: style.align,
    fontWeight: style.fontWeight ?? 'normal',
    fontStyle:
      style.fontStyle === 'italic' || style.fontStyle === 'oblique'
        ? style.fontStyle
        : 'normal',
  });
}

function readCellFromBox(box: Textbox): MenuLineCell {
  return {
    content: box.text ?? '',
    style: {
      fontFamily: box.fontFamily ?? 'Arial',
      fontSize: box.fontSize ?? 18,
      color: typeof box.fill === 'string' ? box.fill : '#333333',
      align: (box.textAlign as MenuLineColumnStyle['align']) ?? 'left',
      fontWeight: String(box.fontWeight ?? 'normal'),
      fontStyle: (box.fontStyle as string) || 'normal',
    },
  };
}

function createCellTextbox(
  key: MenuLineColumnKey,
  rowIndex: number,
  cell: MenuLineCell,
  width: number,
  content: string,
  rowLeader?: MenuLineLeader,
): Textbox {
  const box = new Textbox(content, {
    originX: 'left',
    originY: 'top',
    left: 0,
    top: 0,
    width: Math.max(8, width),
    fontFamily: cell.style.fontFamily,
    fontSize: cell.style.fontSize,
    fill: cell.style.color,
    textAlign: cell.style.align,
    fontWeight: cell.style.fontWeight ?? 'normal',
    fontStyle:
      cell.style.fontStyle === 'italic' || cell.style.fontStyle === 'oblique'
        ? cell.style.fontStyle
        : 'normal',
    editable: true,
    selectable: false,
    evented: true,
    objectCaching: false,
  });
  box.initDimensions();
  setLayerObjectData(box, {
    menuLineRole: key,
    menuLineRowIndex: rowIndex,
    ...(key === 'center' && rowLeader ? { menuLineLeader: rowLeader } : {}),
  });
  return box;
}

export function getMenuLineLeader(group: Group): MenuLineLeader {
  return normalizeLeader(getLayerObjectData(group).menuLineLeader);
}

export function setMenuLineLeader(group: Group, leader: MenuLineLeader): void {
  setLayerObjectData(group, { menuLineLeader: leader });
}

export function getMenuLineRowGap(group: Group): number {
  const gap = getLayerObjectData(group).menuLineRowGap;
  return typeof gap === 'number' && Number.isFinite(gap) && gap >= 0
    ? gap
    : MENU_LINE_DEFAULT_ROW_GAP;
}

export function setMenuLineRowGap(group: Group, gap: number): void {
  const next = Number.isFinite(gap) ? Math.max(0, Math.min(48, gap)) : MENU_LINE_DEFAULT_ROW_GAP;
  setLayerObjectData(group, { menuLineRowGap: next });
}

export function getGroupColumnRatios(group: Group): MenuLineColumnRatios {
  const data = getLayerObjectData(group);
  return normalizeColumnRatios({
    left: data.menuLineRatioLeft,
    center: data.menuLineRatioCenter,
    right: data.menuLineRatioRight,
  });
}

function setGroupColumnRatios(group: Group, ratios: MenuLineColumnRatios): void {
  const next = normalizeColumnRatios(ratios);
  setLayerObjectData(group, {
    menuLineRatioLeft: next.left,
    menuLineRatioCenter: next.center,
    menuLineRatioRight: next.right,
  });
}

function getRowLeader(group: Group, rowIndex: number): MenuLineLeader {
  const center = getMenuLineColumn(group, 'center', rowIndex);
  if (center) {
    const rowLeader = getLayerObjectData(center).menuLineLeader;
    if (rowLeader) return normalizeLeader(rowLeader);
  }
  return getMenuLineLeader(group);
}

/**
 * Recoloca todas las filas con proporciones compartidas y regenera separadores.
 */
export function layoutMenuLineGroup(group: Group): void {
  if (!isMenuLineGroup(group)) return;

  const scaleX = group.scaleX ?? 1;
  const totalWidth = Math.max(40, (group.width ?? 0) * scaleX);
  const ratios = getGroupColumnRatios(group);
  setGroupColumnRatios(group, ratios);

  const widths = {
    left: totalWidth * ratios.left,
    center: totalWidth * ratios.center,
    right: totalWidth * ratios.right,
  };

  const rowCount = getMenuLineRowCount(group);
  const rowGap = getMenuLineRowGap(group);
  const rowHeights: number[] = [];

  for (let r = 0; r < rowCount; r++) {
    const leftBox = getMenuLineColumn(group, 'left', r);
    const centerBox = getMenuLineColumn(group, 'center', r);
    const rightBox = getMenuLineColumn(group, 'right', r);
    if (!leftBox || !centerBox || !rightBox) {
      rowHeights.push(0);
      continue;
    }

    const leader = getRowLeader(group, r);
    if (leader !== 'custom') {
      const style: MenuLineColumnStyle = {
        fontFamily: centerBox.fontFamily ?? 'Arial',
        fontSize: centerBox.fontSize ?? 16,
        color: typeof centerBox.fill === 'string' ? centerBox.fill : '#888888',
        align: (centerBox.textAlign as MenuLineColumnStyle['align']) ?? 'center',
        fontWeight: String(centerBox.fontWeight ?? 'normal'),
        fontStyle: (centerBox.fontStyle as string) || 'normal',
      };
      centerBox.set({
        text: buildLeaderContent(leader, widths.center, style, centerBox.text ?? ''),
      });
    }

    leftBox.set({ scaleX: 1, scaleY: 1, width: widths.left });
    centerBox.set({ scaleX: 1, scaleY: 1, width: widths.center });
    rightBox.set({ scaleX: 1, scaleY: 1, width: widths.right });

    for (const box of [leftBox, centerBox, rightBox]) {
      box.initDimensions();
      box.setCoords();
    }

    rowHeights.push(
      Math.max(leftBox.height ?? 0, centerBox.height ?? 0, rightBox.height ?? 0, 1),
    );
  }

  const totalHeight =
    rowHeights.reduce((a, b) => a + b, 0) + Math.max(0, rowCount - 1) * rowGap;
  let yCursor = -totalHeight / 2;

  for (let r = 0; r < rowCount; r++) {
    const leftBox = getMenuLineColumn(group, 'left', r);
    const centerBox = getMenuLineColumn(group, 'center', r);
    const rightBox = getMenuLineColumn(group, 'right', r);
    if (!leftBox || !centerBox || !rightBox) continue;

    const rowH = rowHeights[r] ?? 1;
    const top = yCursor;

    leftBox.set({ left: -totalWidth / 2, top });
    centerBox.set({ left: -totalWidth / 2 + widths.left, top });
    rightBox.set({ left: -totalWidth / 2 + widths.left + widths.center, top });

    for (const box of [leftBox, centerBox, rightBox]) {
      const h = box.height ?? rowH;
      box.set({ top: top + (rowH - h) / 2 });
      box.setCoords();
    }

    yCursor += rowH + rowGap;
  }

  group.set({
    scaleX: 1,
    scaleY: 1,
    width: totalWidth,
    height: Math.max(1, totalHeight),
  });
  group.setCoords();
  group.canvas?.requestRenderAll();
}

function createBoxesForLayer(
  layer: ReturnType<typeof normalizeMenuLineLayerData>,
  totalWidth: number,
): Textbox[] {
  const ratios = layer.columnRatios;
  const widths = {
    left: totalWidth * ratios.left,
    center: totalWidth * ratios.center,
    right: totalWidth * ratios.right,
  };
  const boxes: Textbox[] = [];

  layer.rows.forEach((row, rowIndex) => {
    const rowLeader = normalizeLeader(row.leader ?? layer.leader);
    const centerContent =
      rowLeader === 'custom'
        ? row.center.content
        : buildLeaderContent(rowLeader, widths.center, row.center.style, row.center.content);

    boxes.push(
      createCellTextbox('left', rowIndex, row.left, widths.left, row.left.content),
      createCellTextbox(
        'center',
        rowIndex,
        row.center,
        widths.center,
        centerContent,
        rowLeader,
      ),
      createCellTextbox('right', rowIndex, row.right, widths.right, row.right.content),
    );
  });

  return boxes;
}

export function menuLineLayerToGroup(layer: MenuLineLayer): Group {
  const normalized = normalizeMenuLineLayerData(layer);
  const totalWidth = Math.max(40, layer.width || 500);
  const boxes = createBoxesForLayer(normalized, totalWidth);

  const group = new Group(boxes, {
    originX: 'left',
    originY: 'top',
    left: layer.x,
    top: layer.y,
    angle: layer.rotation ?? 0,
    opacity: layer.opacity ?? 1,
    visible: layer.visible !== false,
    selectable: layer.locked !== true,
    evented: layer.locked !== true,
    subTargetCheck: true,
    interactive: true,
    objectCaching: false,
  });

  setLayerObjectData(group, {
    layerId: layer.id,
    layerType: 'menuLine',
    layerName: layer.name,
    locked: layer.locked === true,
    menuLineLeader: normalized.leader,
    menuLineRowGap: normalized.rowGap ?? MENU_LINE_DEFAULT_ROW_GAP,
    menuLineRatioLeft: normalized.columnRatios.left,
    menuLineRatioCenter: normalized.columnRatios.center,
    menuLineRatioRight: normalized.columnRatios.right,
  });

  layoutMenuLineGroup(group);
  group.set({ left: layer.x, top: layer.y });
  group.setCoords();
  return group;
}

export function menuLineGroupToLayer(group: Group, zIndex: number): MenuLineLayer | null {
  if (!isMenuLineGroup(group)) return null;
  const data = getLayerObjectData(group);
  const rowCount = getMenuLineRowCount(group);
  const ratios = getGroupColumnRatios(group);
  const rows: MenuLineRow[] = [];

  for (let r = 0; r < rowCount; r++) {
    const leftBox = getMenuLineColumn(group, 'left', r);
    const centerBox = getMenuLineColumn(group, 'center', r);
    const rightBox = getMenuLineColumn(group, 'right', r);
    if (!leftBox || !centerBox || !rightBox) continue;

    const centerData = getLayerObjectData(centerBox);
    const rowLeader = centerData.menuLineLeader
      ? normalizeLeader(centerData.menuLineLeader)
      : undefined;

    rows.push({
      left: readCellFromBox(leftBox),
      center: readCellFromBox(centerBox),
      right: readCellFromBox(rightBox),
      ...(rowLeader ? { leader: rowLeader } : {}),
    });
  }

  if (rows.length === 0) return null;

  const scaleX = group.scaleX ?? 1;
  const scaleY = group.scaleY ?? 1;

  return {
    id: data.layerId ?? `layer_${crypto.randomUUID().slice(0, 8)}`,
    type: 'menuLine',
    name: data.layerName?.trim() || 'Línea de carta',
    x: group.left ?? 0,
    y: group.top ?? 0,
    width: Math.max(40, (group.width ?? 0) * scaleX),
    height: Math.max(1, (group.height ?? 0) * scaleY),
    rotation: group.angle ?? 0,
    zIndex,
    visible: group.visible !== false,
    locked: typeof data.locked === 'boolean' ? data.locked : group.selectable === false,
    opacity: group.opacity ?? 1,
    leader: getMenuLineLeader(group),
    columnRatios: ratios,
    rows,
    rowGap: getMenuLineRowGap(group),
  };
}

function rebuildGroupFromLayer(group: Group, layer: MenuLineLayer): void {
  const normalized = normalizeMenuLineLayerData(layer);
  const totalWidth = Math.max(40, layer.width || (group.width ?? 500));
  const left = group.left ?? 0;
  const top = group.top ?? 0;
  const angle = group.angle ?? 0;
  const opacity = group.opacity ?? 1;

  const existing = [...group.getObjects()];
  group.remove(...existing);

  const boxes = createBoxesForLayer(normalized, totalWidth);
  group.add(...boxes);

  setLayerObjectData(group, {
    layerId: layer.id,
    layerType: 'menuLine',
    layerName: layer.name,
    locked: layer.locked === true,
    menuLineLeader: normalized.leader,
    menuLineRowGap: normalized.rowGap ?? MENU_LINE_DEFAULT_ROW_GAP,
    menuLineRatioLeft: normalized.columnRatios.left,
    menuLineRatioCenter: normalized.columnRatios.center,
    menuLineRatioRight: normalized.columnRatios.right,
  });

  group.set({ left, top, angle, opacity, scaleX: 1, scaleY: 1, width: totalWidth });
  layoutMenuLineGroup(group);
  group.set({ left, top });
  group.setCoords();
  group.canvas?.requestRenderAll();
}

export function addMenuLineRow(group: Group): void {
  const layer = menuLineGroupToLayer(group, 1);
  if (!layer) return;
  const last = layer.rows[layer.rows.length - 1] ?? defaultRowTemplate();
  layer.rows.push(cloneRowAsTemplate(last));
  rebuildGroupFromLayer(group, layer);
}

export function removeMenuLineRow(group: Group, rowIndex: number): void {
  const layer = menuLineGroupToLayer(group, 1);
  if (!layer || layer.rows.length <= 1) return;
  if (rowIndex < 0 || rowIndex >= layer.rows.length) return;
  layer.rows.splice(rowIndex, 1);
  rebuildGroupFromLayer(group, layer);
}

export function updateMenuLineColumnStyle(
  group: Group,
  key: MenuLineColumnKey,
  patch: Partial<MenuLineColumnStyle>,
  rowIndex: number | 'all' = 0,
): void {
  const count = getMenuLineRowCount(group);
  const indices =
    rowIndex === 'all'
      ? Array.from({ length: count }, (_, i) => i)
      : [rowIndex];

  for (const i of indices) {
    const box = getMenuLineColumn(group, key, i);
    if (!box) continue;
    const next: MenuLineColumnStyle = {
      fontFamily: box.fontFamily ?? 'Arial',
      fontSize: box.fontSize ?? 18,
      color: typeof box.fill === 'string' ? box.fill : '#333333',
      align: (box.textAlign as MenuLineColumnStyle['align']) ?? 'left',
      fontWeight: String(box.fontWeight ?? 'normal'),
      fontStyle: (box.fontStyle as string) || 'normal',
      ...patch,
    };
    applyColumnStyle(box, next);
  }
  layoutMenuLineGroup(group);
}

export function updateMenuLineColumnContent(
  group: Group,
  key: MenuLineColumnKey,
  content: string,
  rowIndex = 0,
): void {
  const box = getMenuLineColumn(group, key, rowIndex);
  if (!box) return;
  if (key === 'center') {
    setLayerObjectData(box, { menuLineLeader: 'custom' });
  }
  box.set({ text: content });
  layoutMenuLineGroup(group);
}

export function updateMenuLineLeader(
  group: Group,
  leader: MenuLineLeader,
  rowIndex?: number | 'all',
): void {
  if (rowIndex === 'all' || rowIndex === undefined) {
    setMenuLineLeader(group, leader);
    const count = getMenuLineRowCount(group);
    for (let r = 0; r < count; r++) {
      const center = getMenuLineColumn(group, 'center', r);
      if (!center) continue;
      setLayerObjectData(center, { menuLineLeader: leader });
    }
  } else {
    const center = getMenuLineColumn(group, 'center', rowIndex);
    if (center) setLayerObjectData(center, { menuLineLeader: leader });
  }
  layoutMenuLineGroup(group);
}

export function updateMenuLineColumnRatio(
  group: Group,
  key: MenuLineColumnKey,
  ratio: number,
): void {
  const current = getGroupColumnRatios(group);
  const next = normalizeColumnRatios({
    ...current,
    [key]: normalizeRatio(ratio, current[key]),
  });
  setGroupColumnRatios(group, next);
  layoutMenuLineGroup(group);
}

export function updateMenuLineRowGap(group: Group, gap: number): void {
  setMenuLineRowGap(group, gap);
  layoutMenuLineGroup(group);
}

export function finalizeMenuLineTransform(group: Group): void {
  layoutMenuLineGroup(group);
}

export function findMenuLineCellAtPoint(
  group: Group,
  sceneX: number,
  sceneY: number,
): { rowIndex: number; key: MenuLineColumnKey } | null {
  const bounds = group.getBoundingRect();
  const relX = sceneX - bounds.left;
  const relY = sceneY - bounds.top;
  const ratios = getGroupColumnRatios(group);
  const w = Math.max(1, bounds.width);
  const leftW = w * ratios.left;
  const centerW = w * ratios.center;

  let key: MenuLineColumnKey = 'right';
  if (relX < leftW) key = 'left';
  else if (relX < leftW + centerW) key = 'center';

  const rowCount = getMenuLineRowCount(group);
  const rowGap = getMenuLineRowGap(group);
  let y = 0;
  for (let r = 0; r < rowCount; r++) {
    const leftBox = getMenuLineColumn(group, 'left', r);
    const h = Math.max(
      leftBox?.height ?? 0,
      getMenuLineColumn(group, 'center', r)?.height ?? 0,
      getMenuLineColumn(group, 'right', r)?.height ?? 0,
      1,
    ) * (group.scaleY ?? 1);
    if (relY >= y && relY <= y + h + (r < rowCount - 1 ? rowGap : 0)) {
      return { rowIndex: r, key };
    }
    y += h + rowGap;
  }

  if (rowCount > 0) return { rowIndex: rowCount - 1, key };
  return null;
}

/** @deprecated usar findMenuLineCellAtPoint */
export function findMenuLineColumnAtPoint(
  group: Group,
  sceneX: number,
): MenuLineColumnKey | null {
  const cell = findMenuLineCellAtPoint(group, sceneX, group.getBoundingRect().top + 1);
  return cell?.key ?? null;
}

export function beginMenuLineColumnEditing(
  canvas: Canvas,
  group: Group,
  key: MenuLineColumnKey,
  rowIndex = 0,
): boolean {
  const box = getMenuLineColumn(group, key, rowIndex);
  if (!box) return false;
  try {
    canvas.setActiveObject(group);
    box.set({ selectable: true, evented: true });
    if (typeof (box as Textbox & { enterEditing?: () => void }).enterEditing === 'function') {
      box.enterEditing();
      box.selectAll();
      canvas.requestRenderAll();
      return true;
    }
  } catch {
    /* panel como fallback */
  }
  return false;
}
