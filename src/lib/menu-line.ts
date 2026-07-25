import { Group, Textbox, LayoutManager, FixedLayout, type Canvas, type FabricObject } from 'fabric';
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
export const MENU_LINE_MIN_CENTER = 12;
export const MENU_LINE_MIN_LEFT = 40;
export const MENU_LINE_MIN_TOTAL = 80;
/** Máximo de saltos de línea extra entre filas. */
export const MENU_LINE_MAX_BLANK_LINES = 12;

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

/** Normaliza capa (legacy `columns` → `rows` + `leftWidth`). */
export function normalizeMenuLineLayerData(
  layer: MenuLineLayer,
): Omit<MenuLineLayer, 'columns'> & { columns?: undefined } {
  const template = defaultRowTemplate();
  let rows: MenuLineRow[] = [];

  if (Array.isArray(layer.rows) && layer.rows.length > 0) {
    rows = layer.rows.map((row) => {
      const base: MenuLineRow = {
        left: normalizeCell(row?.left, template.left),
        center: normalizeCell(row?.center, template.center),
        right: normalizeCell(row?.right, template.right),
        leader: row?.leader ? normalizeLeader(row.leader) : undefined,
      };
      if (row?.ingredients && typeof row.ingredients === 'object') {
        const ingFallback: MenuLineCell = {
          content: '',
          style: {
            ...template.left.style,
            fontSize: Math.max(8, template.left.style.fontSize - 3),
            color: '#666666',
            fontWeight: 'normal',
          },
        };
        const ing = normalizeCell(row.ingredients, ingFallback);
        if (ing.content.trim()) base.ingredients = ing;
      }
      const blanks = normalizeBlankLinesAfter(row?.blankLinesAfter);
      if (blanks > 0) base.blankLinesAfter = blanks;
      return base;
    });
  } else if (layer.columns) {
    rows = [rowFromLegacyColumns(layer.columns)];
  } else {
    rows = [template];
  }

  const totalWidth = Math.max(MENU_LINE_MIN_TOTAL, layer.width || 500);
  const ratios = normalizeColumnRatios(layer.columnRatios, layer.columns);
  const leftWidth =
    typeof layer.leftWidth === 'number' &&
    Number.isFinite(layer.leftWidth) &&
    layer.leftWidth > 0
      ? Math.round(layer.leftWidth)
      : Math.round(ratios.left * totalWidth);

  return {
    ...layer,
    leader: normalizeLeader(layer.leader),
    leftWidth,
    columnRatios: ratios,
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
  const width = Math.max(MENU_LINE_MIN_TOTAL, totalWidth);
  const leftWidth = Math.round(width * 0.48);
  return {
    id: `layer_${crypto.randomUUID().slice(0, 8)}`,
    type: 'menuLine',
    name: 'Línea de carta',
    x,
    y,
    width,
    height: 28,
    rotation: 0,
    zIndex: 1,
    leader: 'dots',
    leftWidth,
    columnRatios: {
      left: leftWidth / width,
      center: 0.32,
      right: 0.2,
    },
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
  if (kids.length < 3) return false;
  return kids.some((child) => getLayerObjectData(child).menuLineRole === 'left')
    && kids.some((child) => getLayerObjectData(child).menuLineRole === 'right');
}

export function getMenuLineRowCount(group: Group): number {
  let max = -1;
  for (const child of group.getObjects()) {
    if (!(child instanceof Textbox)) continue;
    const data = getLayerObjectData(child);
    if (data.menuLineRole !== 'left') continue;
    const idx = typeof data.menuLineRowIndex === 'number' ? data.menuLineRowIndex : 0;
    max = Math.max(max, idx);
  }
  if (max >= 0) return max + 1;
  const kids = group.getObjects().filter((c) => c instanceof Textbox);
  return Math.max(1, Math.floor(kids.length / 3));
}

export function getMenuLineColumn(
  group: Group,
  key: MenuLineColumnKey | 'ingredients',
  rowIndex = 0,
): Textbox | null {
  for (const child of group.getObjects()) {
    if (!(child instanceof Textbox)) continue;
    const data = getLayerObjectData(child);
    const idx = typeof data.menuLineRowIndex === 'number' ? data.menuLineRowIndex : 0;
    if (data.menuLineRole === key && idx === rowIndex) return child;
  }
  if (rowIndex === 0 && key !== 'ingredients') {
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

/**
 * Símbolo que se repite en el separador personalizado.
 * - Vacío → ·
 * - "····" → ·
 * - Al escribir encima de otro (p. ej. "–*"), se queda con el último símbolo.
 */
export function normalizeLeaderUnit(raw: string | undefined | null): string {
  const cleaned = (raw ?? '').replace(/\u00a0/g, ' ').trim();
  if (!cleaned) return '·';
  const chars = Array.from(cleaned);
  if (chars.length === 0) return '·';
  if (chars.length > 1 && chars.every((c) => c === chars[0])) return chars[0];
  return chars[chars.length - 1] ?? '·';
}

function repeatLeaderUnit(
  unitRaw: string,
  columnWidth: number,
  style: MenuLineColumnStyle,
): string {
  const ch = normalizeLeaderUnit(unitRaw);
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
  const unitWidth = measured > 0 ? measured / 20 : Math.max(4, style.fontSize * 0.45);
  const count = Math.max(1, Math.floor(Math.max(0, columnWidth - 4) / unitWidth));
  return ch.repeat(count);
}

export function buildLeaderContent(
  leader: MenuLineLeader,
  columnWidth: number,
  style: MenuLineColumnStyle,
  customContent = '',
): string {
  if (leader === 'custom') {
    return repeatLeaderUnit(customContent, columnWidth, style);
  }
  return repeatLeaderUnit(leaderChar(leader), columnWidth, style);
}

export function getMenuLineLeaderUnit(group: Group, rowIndex = 0): string {
  const center = getMenuLineColumn(group, 'center', rowIndex);
  if (!center) return '·';
  const data = getLayerObjectData(center);
  if (typeof data.menuLineLeaderUnit === 'string' && data.menuLineLeaderUnit.length > 0) {
    return normalizeLeaderUnit(data.menuLineLeaderUnit);
  }
  return normalizeLeaderUnit(center.text ?? '');
}

export function setMenuLineLeaderUnit(
  group: Group,
  rowIndex: number,
  unit: string,
): void {
  const center = getMenuLineColumn(group, 'center', rowIndex);
  if (!center) return;
  const next = normalizeLeaderUnit(unit);
  setLayerObjectData(center, {
    menuLineLeader: 'custom',
    menuLineLeaderUnit: next,
  });
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

function normalizeBlankLinesAfter(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MENU_LINE_MAX_BLANK_LINES, Math.round(value)));
}

/** Altura aproximada de un salto de línea (según tipografía del plato). */
function blankLineHeightPx(fontSize: number): number {
  return Math.max(8, Math.round(Math.max(8, fontSize) * 1.25));
}

export function getMenuLineBlankLinesAfter(group: Group, rowIndex: number): number {
  const left = getMenuLineColumn(group, 'left', rowIndex);
  if (!left) return 0;
  return normalizeBlankLinesAfter(getLayerObjectData(left).menuLineBlankLinesAfter);
}

export function setMenuLineBlankLinesAfter(
  group: Group,
  rowIndex: number,
  blankLines: number,
): void {
  const left = getMenuLineColumn(group, 'left', rowIndex);
  if (!left) return;
  const next = normalizeBlankLinesAfter(blankLines);
  setLayerObjectData(left, { menuLineBlankLinesAfter: next });
}

function createCellTextbox(
  key: MenuLineColumnKey,
  rowIndex: number,
  cell: MenuLineCell,
  width: number,
  content: string,
  rowLeader?: MenuLineLeader,
  blankLinesAfter = 0,
  leaderUnit?: string,
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
    // El grupo recibe los clics; si las celdas son evented, solo el glifo “cuenta”
    // y hay que acertar el texto para seleccionar la línea.
    evented: false,
    objectCaching: false,
    perPixelTargetFind: false,
  });
  box.initDimensions();
  setLayerObjectData(box, {
    menuLineRole: key,
    menuLineRowIndex: rowIndex,
    ...(key === 'center' && rowLeader ? { menuLineLeader: rowLeader } : {}),
    ...(key === 'center' && rowLeader === 'custom'
      ? { menuLineLeaderUnit: normalizeLeaderUnit(leaderUnit ?? cell.content) }
      : {}),
    ...(key === 'left'
      ? { menuLineBlankLinesAfter: normalizeBlankLinesAfter(blankLinesAfter) }
      : {}),
  });
  return box;
}

const MENU_LINE_INGREDIENTS_GAP = 2;

function createIngredientsTextbox(
  rowIndex: number,
  cell: MenuLineCell,
  width: number,
): Textbox {
  const box = new Textbox(cell.content, {
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
    evented: false,
    objectCaching: false,
    perPixelTargetFind: false,
  });
  box.initDimensions();
  setLayerObjectData(box, {
    menuLineRole: 'ingredients',
    menuLineRowIndex: rowIndex,
  });
  return box;
}

/** Celdas no interceptan el ratón: se selecciona/mueve el bloque entero. */
export function syncMenuLineChildInteraction(group: Group): void {
  for (const child of group.getObjects()) {
    if (!(child instanceof Textbox)) continue;
    const editing = !!(child as Textbox & { isEditing?: boolean }).isEditing;
    child.set({
      selectable: false,
      evented: editing,
      perPixelTargetFind: false,
    });
  }
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

export function getMenuLineLeftWidth(group: Group): number {
  const data = getLayerObjectData(group);
  if (typeof data.menuLineLeftWidth === 'number' && data.menuLineLeftWidth > 0) {
    return data.menuLineLeftWidth;
  }
  const total = Math.max(MENU_LINE_MIN_TOTAL, (group.width ?? 0) * (group.scaleX ?? 1));
  return Math.round(getGroupColumnRatios(group).left * total);
}

export function setMenuLineLeftWidth(group: Group, leftWidth: number): void {
  setLayerObjectData(group, {
    menuLineLeftWidth: Math.max(MENU_LINE_MIN_LEFT, Math.round(leftWidth)),
  });
}

function styleFromBox(box: Textbox): MenuLineColumnStyle {
  return {
    fontFamily: box.fontFamily ?? 'Arial',
    fontSize: box.fontSize ?? 18,
    color: typeof box.fill === 'string' ? box.fill : '#333333',
    align: (box.textAlign as MenuLineColumnStyle['align']) ?? 'left',
    fontWeight: String(box.fontWeight ?? 'normal'),
    fontStyle: (box.fontStyle as string) || 'normal',
  };
}

/** Mide el ancho intrínseco del texto (sin forzar wrap). */
export function measureTextContentWidth(
  text: string,
  style: MenuLineColumnStyle,
): number {
  const sample = text.length > 0 ? text : '0';
  const probe = new Textbox(sample, {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight ?? 'normal',
    fontStyle:
      style.fontStyle === 'italic' || style.fontStyle === 'oblique'
        ? style.fontStyle
        : 'normal',
    width: 20_000,
  });
  probe.initDimensions();
  return Math.max(8, Math.ceil(probe.calcTextWidth()) + 2);
}

export interface MenuLineComputedWidths {
  total: number;
  left: number;
  center: number;
  right: number;
}

/** Precio al contenido; plato con ancho preferido; centro = resto. */
export function computeMenuLineWidths(
  totalWidth: number,
  preferredLeftWidth: number,
  rightContentWidth: number,
): MenuLineComputedWidths {
  const total = Math.max(MENU_LINE_MIN_TOTAL, totalWidth);
  const right = Math.min(
    Math.max(8, Math.ceil(rightContentWidth)),
    Math.max(8, total - MENU_LINE_MIN_LEFT - MENU_LINE_MIN_CENTER),
  );
  const maxLeft = Math.max(MENU_LINE_MIN_LEFT, total - right - MENU_LINE_MIN_CENTER);
  const left = Math.min(
    Math.max(MENU_LINE_MIN_LEFT, Math.round(preferredLeftWidth)),
    maxLeft,
  );
  const center = Math.max(MENU_LINE_MIN_CENTER, total - left - right);
  return { total, left, center, right };
}

function measureMaxRightWidthFromGroup(group: Group): number {
  const rowCount = getMenuLineRowCount(group);
  let maxW = 8;
  for (let r = 0; r < rowCount; r++) {
    const rightBox = getMenuLineColumn(group, 'right', r);
    if (!rightBox) continue;
    maxW = Math.max(maxW, measureTextContentWidth(rightBox.text ?? '', styleFromBox(rightBox)));
  }
  return maxW;
}

function measureMaxRightWidthFromRows(rows: MenuLineRow[]): number {
  let maxW = 8;
  for (const row of rows) {
    maxW = Math.max(maxW, measureTextContentWidth(row.right.content, row.right.style));
  }
  return maxW;
}

function getRowLeader(group: Group, rowIndex: number): MenuLineLeader {
  const center = getMenuLineColumn(group, 'center', rowIndex);
  if (center) {
    const rowLeader = getLayerObjectData(center).menuLineLeader;
    if (rowLeader) return normalizeLeader(rowLeader);
  }
  return getMenuLineLeader(group);
}

function applyFixedLayout(group: Group): void {
  try {
    group.layoutManager = new LayoutManager(new FixedLayout());
  } catch {
    /* ignore */
  }
}

/**
 * Contenedor W (sin escalar tipografía): plato fijo, precio al texto, centro rellena.
 */
export function layoutMenuLineGroup(group: Group): void {
  if (!isMenuLineGroup(group)) return;

  const scaleX = group.scaleX ?? 1;
  const totalWidth = Math.max(MENU_LINE_MIN_TOTAL, (group.width ?? 0) * scaleX);
  const preferredLeft = getMenuLineLeftWidth(group);
  const widths = computeMenuLineWidths(
    totalWidth,
    preferredLeft,
    measureMaxRightWidthFromGroup(group),
  );

  setMenuLineLeftWidth(group, widths.left);
  setGroupColumnRatios(group, {
    left: widths.left / widths.total,
    center: widths.center / widths.total,
    right: widths.right / widths.total,
  });

  const rowCount = getMenuLineRowCount(group);
  const rowGap = getMenuLineRowGap(group);
  const dishHeights: number[] = [];
  const ingredientHeights: number[] = [];

  for (let r = 0; r < rowCount; r++) {
    const leftBox = getMenuLineColumn(group, 'left', r);
    const centerBox = getMenuLineColumn(group, 'center', r);
    const rightBox = getMenuLineColumn(group, 'right', r);
    const ingredientsBox = getMenuLineColumn(group, 'ingredients', r);
    if (!leftBox || !centerBox || !rightBox) {
      dishHeights.push(0);
      ingredientHeights.push(0);
      continue;
    }

    const leader = getRowLeader(group, r);
    const style = styleFromBox(centerBox);
    const unit =
      leader === 'custom'
        ? getMenuLineLeaderUnit(group, r)
        : leaderChar(leader);
    if (leader === 'custom') {
      setLayerObjectData(centerBox, { menuLineLeaderUnit: unit });
    }
    centerBox.set({
      text: buildLeaderContent(leader, widths.center, style, unit),
    });

    leftBox.set({ scaleX: 1, scaleY: 1, width: widths.left });
    centerBox.set({ scaleX: 1, scaleY: 1, width: widths.center });
    rightBox.set({ scaleX: 1, scaleY: 1, width: widths.right });

    for (const box of [leftBox, centerBox, rightBox]) {
      box.initDimensions();
      box.setCoords();
    }

    dishHeights.push(
      Math.max(leftBox.height ?? 0, centerBox.height ?? 0, rightBox.height ?? 0, 1),
    );

    if (ingredientsBox && (ingredientsBox.text ?? '').trim()) {
      ingredientsBox.set({ scaleX: 1, scaleY: 1, width: widths.total });
      ingredientsBox.initDimensions();
      ingredientsBox.setCoords();
      ingredientHeights.push(Math.max(1, ingredientsBox.height ?? 0));
    } else {
      if (ingredientsBox) {
        ingredientsBox.set({ scaleX: 1, scaleY: 1, width: widths.total, text: '' });
        ingredientsBox.initDimensions();
      }
      ingredientHeights.push(0);
    }
  }

  let totalHeight = 0;
  for (let r = 0; r < rowCount; r++) {
    totalHeight += dishHeights[r] ?? 0;
    const ingH = ingredientHeights[r] ?? 0;
    if (ingH > 0) totalHeight += MENU_LINE_INGREDIENTS_GAP + ingH;
    const leftBox = getMenuLineColumn(group, 'left', r);
    const blanks = getMenuLineBlankLinesAfter(group, r);
    const blankPx = blanks * blankLineHeightPx(leftBox?.fontSize ?? 18);
    if (r < rowCount - 1) totalHeight += rowGap + blankPx;
    else totalHeight += blankPx;
  }
  let yCursor = -totalHeight / 2;

  for (let r = 0; r < rowCount; r++) {
    const leftBox = getMenuLineColumn(group, 'left', r);
    const centerBox = getMenuLineColumn(group, 'center', r);
    const rightBox = getMenuLineColumn(group, 'right', r);
    const ingredientsBox = getMenuLineColumn(group, 'ingredients', r);
    if (!leftBox || !centerBox || !rightBox) continue;

    const dishH = dishHeights[r] ?? 1;
    const top = yCursor;

    leftBox.set({ left: -widths.total / 2, top });
    centerBox.set({ left: -widths.total / 2 + widths.left, top });
    rightBox.set({ left: -widths.total / 2 + widths.left + widths.center, top });

    for (const box of [leftBox, centerBox, rightBox]) {
      const h = box.height ?? dishH;
      box.set({ top: top + (dishH - h) / 2 });
      box.setCoords();
    }

    yCursor += dishH;

    const ingH = ingredientHeights[r] ?? 0;
    if (ingredientsBox && ingH > 0) {
      yCursor += MENU_LINE_INGREDIENTS_GAP;
      ingredientsBox.set({
        left: -widths.total / 2,
        top: yCursor,
        visible: true,
      });
      ingredientsBox.setCoords();
      yCursor += ingH;
    } else if (ingredientsBox) {
      ingredientsBox.set({
        left: -widths.total / 2,
        top: yCursor,
        visible: false,
      });
      ingredientsBox.setCoords();
    }

    const blanks = getMenuLineBlankLinesAfter(group, r);
    const blankPx = blanks * blankLineHeightPx(leftBox.fontSize ?? 18);
    if (r < rowCount - 1) yCursor += rowGap + blankPx;
    else yCursor += blankPx;
  }

  const left = group.left ?? 0;
  const topPos = group.top ?? 0;

  applyFixedLayout(group);
  group.set({
    scaleX: 1,
    scaleY: 1,
    width: widths.total,
    height: Math.max(1, totalHeight),
    left,
    top: topPos,
    perPixelTargetFind: false,
    subTargetCheck: false,
    interactive: false,
    lockScalingY: true,
    lockSkewingX: true,
    lockSkewingY: true,
    padding: 2,
  });
  syncMenuLineChildInteraction(group);
  group.setCoords();
  group.canvas?.requestRenderAll();
}

function createBoxesForLayer(
  layer: ReturnType<typeof normalizeMenuLineLayerData>,
  totalWidth: number,
): Textbox[] {
  const widths = computeMenuLineWidths(
    totalWidth,
    layer.leftWidth ?? totalWidth * 0.48,
    measureMaxRightWidthFromRows(layer.rows),
  );
  const boxes: Textbox[] = [];

  layer.rows.forEach((row, rowIndex) => {
    const rowLeader = normalizeLeader(row.leader ?? layer.leader);
    const leaderUnit =
      rowLeader === 'custom' ? normalizeLeaderUnit(row.center.content) : undefined;
    const centerContent = buildLeaderContent(
      rowLeader,
      widths.center,
      row.center.style,
      leaderUnit ?? row.center.content,
    );

    boxes.push(
      createCellTextbox(
        'left',
        rowIndex,
        row.left,
        widths.left,
        row.left.content,
        undefined,
        row.blankLinesAfter ?? 0,
      ),
      createCellTextbox(
        'center',
        rowIndex,
        row.center,
        widths.center,
        centerContent,
        rowLeader,
        0,
        leaderUnit,
      ),
      createCellTextbox('right', rowIndex, row.right, widths.right, row.right.content),
    );

    if (row.ingredients?.content.trim()) {
      boxes.push(
        createIngredientsTextbox(rowIndex, row.ingredients, widths.total),
      );
    }
  });

  return boxes;
}

export function menuLineLayerToGroup(layer: MenuLineLayer): Group {
  const normalized = normalizeMenuLineLayerData(layer);
  const totalWidth = Math.max(MENU_LINE_MIN_TOTAL, layer.width || 500);
  const boxes = createBoxesForLayer(normalized, totalWidth);

  const group = new Group(boxes, {
    originX: 'left',
    originY: 'top',
    left: layer.x,
    top: layer.y,
    width: totalWidth,
    angle: layer.rotation ?? 0,
    opacity: layer.opacity ?? 1,
    visible: layer.visible !== false,
    selectable: layer.locked !== true,
    evented: layer.locked !== true,
    subTargetCheck: false,
    interactive: false,
    objectCaching: false,
    perPixelTargetFind: false,
    lockScalingY: true,
    lockSkewingX: true,
    lockSkewingY: true,
    padding: 2,
    layoutManager: new LayoutManager(new FixedLayout()),
  });

  setLayerObjectData(group, {
    layerId: layer.id,
    layerType: 'menuLine',
    layerName: layer.name,
    locked: layer.locked === true,
    menuLineLeader: normalized.leader,
    menuLineRowGap: normalized.rowGap ?? MENU_LINE_DEFAULT_ROW_GAP,
    menuLineLeftWidth: normalized.leftWidth,
    menuLineRatioLeft: normalized.columnRatios.left,
    menuLineRatioCenter: normalized.columnRatios.center,
    menuLineRatioRight: normalized.columnRatios.right,
  });

  layoutMenuLineGroup(group);
  group.set({ left: layer.x, top: layer.y, width: totalWidth });
  group.setCoords();
  return group;
}

export function menuLineGroupToLayer(group: Group, zIndex: number): MenuLineLayer | null {
  if (!isMenuLineGroup(group)) return null;

  // Consolida scale→ancho si el usuario acaba de estirar el contenedor.
  if ((group.scaleX ?? 1) !== 1 || (group.scaleY ?? 1) !== 1) {
    layoutMenuLineGroup(group);
  }

  const data = getLayerObjectData(group);
  const rowCount = getMenuLineRowCount(group);
  const ratios = getGroupColumnRatios(group);
  const leftWidth = getMenuLineLeftWidth(group);
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

    const ingredientsBox = getMenuLineColumn(group, 'ingredients', r);
    const ingredientsText = ingredientsBox?.text?.trim() ?? '';
    const ingredients =
      ingredientsBox && ingredientsText
        ? readCellFromBox(ingredientsBox)
        : undefined;

    const blankLinesAfter = getMenuLineBlankLinesAfter(group, r);
    const centerCell = readCellFromBox(centerBox);
    if (rowLeader === 'custom') {
      centerCell.content = getMenuLineLeaderUnit(group, r);
    }

    rows.push({
      left: readCellFromBox(leftBox),
      center: centerCell,
      right: readCellFromBox(rightBox),
      ...(rowLeader ? { leader: rowLeader } : {}),
      ...(ingredients ? { ingredients } : {}),
      ...(blankLinesAfter > 0 ? { blankLinesAfter } : {}),
    });
  }

  if (rows.length === 0) return null;

  const width = Math.max(MENU_LINE_MIN_TOTAL, (group.width ?? 0) * (group.scaleX ?? 1));
  const height = Math.max(1, (group.height ?? 0) * (group.scaleY ?? 1));

  return {
    id: data.layerId ?? `layer_${crypto.randomUUID().slice(0, 8)}`,
    type: 'menuLine',
    name: data.layerName?.trim() || 'Línea de carta',
    x: group.left ?? 0,
    y: group.top ?? 0,
    width,
    height,
    rotation: group.angle ?? 0,
    zIndex,
    visible: group.visible !== false,
    locked: typeof data.locked === 'boolean' ? data.locked : group.selectable === false,
    opacity: group.opacity ?? 1,
    leader: getMenuLineLeader(group),
    leftWidth,
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
    menuLineLeftWidth: normalized.leftWidth,
    menuLineRatioLeft: normalized.columnRatios.left,
    menuLineRatioCenter: normalized.columnRatios.center,
    menuLineRatioRight: normalized.columnRatios.right,
  });

  applyFixedLayout(group);
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
    const unit = normalizeLeaderUnit(content);
    setLayerObjectData(box, {
      menuLineLeader: 'custom',
      menuLineLeaderUnit: unit,
    });
    // El layout rellena el texto repetido a partir del símbolo.
    layoutMenuLineGroup(group);
    return;
  }
  box.set({ text: content });
  layoutMenuLineGroup(group);
}

/** Cambia solo el símbolo del separador personalizado (se repite solo). */
export function updateMenuLineLeaderUnit(
  group: Group,
  unit: string,
  rowIndex: number | 'all' = 0,
): void {
  const count = getMenuLineRowCount(group);
  const indices =
    rowIndex === 'all'
      ? Array.from({ length: count }, (_, i) => i)
      : [rowIndex];
  for (const i of indices) {
    setMenuLineLeaderUnit(group, i, unit);
  }
  layoutMenuLineGroup(group);
}

/** Actualiza (o crea/elimina) la línea de ingredientes bajo una fila. */
export function updateMenuLineIngredientsContent(
  group: Group,
  content: string,
  rowIndex = 0,
): void {
  const trimmed = content.trim();
  const existing = getMenuLineColumn(group, 'ingredients', rowIndex);
  if (existing) {
    if (!trimmed) {
      const layer = menuLineGroupToLayer(group, 1);
      if (!layer?.rows[rowIndex]) return;
      delete layer.rows[rowIndex].ingredients;
      rebuildGroupFromLayer(group, layer);
      return;
    }
    existing.set({ text: trimmed, visible: true });
    layoutMenuLineGroup(group);
    return;
  }
  if (!trimmed) return;

  const layer = menuLineGroupToLayer(group, 1);
  if (!layer?.rows[rowIndex]) return;
  const leftStyle = layer.rows[rowIndex].left.style;
  layer.rows[rowIndex].ingredients = {
    content: trimmed,
    style: {
      ...leftStyle,
      fontSize: Math.max(8, leftStyle.fontSize - 3),
      color: '#666666',
      fontWeight: 'normal',
      align: 'left',
    },
  };
  rebuildGroupFromLayer(group, layer);
}

export function updateMenuLineIngredientsStyle(
  group: Group,
  patch: Partial<MenuLineColumnStyle>,
  rowIndex: number | 'all' = 0,
): void {
  const count = getMenuLineRowCount(group);
  const indices =
    rowIndex === 'all'
      ? Array.from({ length: count }, (_, i) => i)
      : [rowIndex];

  let needsRebuild = false;
  for (const i of indices) {
    const box = getMenuLineColumn(group, 'ingredients', i);
    if (!box) continue;
    const next: MenuLineColumnStyle = {
      fontFamily: box.fontFamily ?? 'Arial',
      fontSize: box.fontSize ?? 14,
      color: typeof box.fill === 'string' ? box.fill : '#666666',
      align: (box.textAlign as MenuLineColumnStyle['align']) ?? 'left',
      fontWeight: String(box.fontWeight ?? 'normal'),
      fontStyle: (box.fontStyle as string) || 'normal',
      ...patch,
    };
    applyColumnStyle(box, next);
    needsRebuild = true;
  }
  if (needsRebuild) layoutMenuLineGroup(group);
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
      if (leader === 'custom') {
        const data = getLayerObjectData(center);
        const unit =
          data.menuLineLeader === 'custom' &&
          typeof data.menuLineLeaderUnit === 'string' &&
          data.menuLineLeaderUnit.length > 0
            ? normalizeLeaderUnit(data.menuLineLeaderUnit)
            : '·';
        setLayerObjectData(center, {
          menuLineLeader: leader,
          menuLineLeaderUnit: unit,
        });
      } else {
        setLayerObjectData(center, { menuLineLeader: leader });
      }
    }
  } else {
    const center = getMenuLineColumn(group, 'center', rowIndex);
    if (center) {
      if (leader === 'custom') {
        const data = getLayerObjectData(center);
        const unit =
          data.menuLineLeader === 'custom' &&
          typeof data.menuLineLeaderUnit === 'string' &&
          data.menuLineLeaderUnit.length > 0
            ? normalizeLeaderUnit(data.menuLineLeaderUnit)
            : '·';
        setLayerObjectData(center, {
          menuLineLeader: leader,
          menuLineLeaderUnit: unit,
        });
      } else {
        setLayerObjectData(center, { menuLineLeader: leader });
      }
    }
  }
  layoutMenuLineGroup(group);
}

export function updateMenuLineColumnRatio(
  group: Group,
  key: MenuLineColumnKey,
  ratio: number,
): void {
  // Solo la columna plato es configurable; precio y centro son automáticos.
  if (key !== 'left') return;
  const total = Math.max(MENU_LINE_MIN_TOTAL, (group.width ?? 0) * (group.scaleX ?? 1));
  const leftWidth = Math.round(normalizeRatio(ratio, 0.48) * total);
  setMenuLineLeftWidth(group, leftWidth);
  layoutMenuLineGroup(group);
}

/** Ajusta el ancho de la columna plato en px de diseño. */
export function updateMenuLineLeftWidth(group: Group, leftWidthPx: number): void {
  setMenuLineLeftWidth(group, leftWidthPx);
  layoutMenuLineGroup(group);
}

export function updateMenuLineRowGap(group: Group, gap: number): void {
  setMenuLineRowGap(group, gap);
  layoutMenuLineGroup(group);
}

/** Saltos de línea extra tras una fila (después de ingredientes si existen). */
export function updateMenuLineBlankLinesAfter(
  group: Group,
  rowIndex: number | 'all',
  blankLines: number,
): void {
  if (rowIndex === 'all') {
    const count = getMenuLineRowCount(group);
    for (let r = 0; r < count; r++) {
      setMenuLineBlankLinesAfter(group, r, blankLines);
    }
  } else {
    setMenuLineBlankLinesAfter(group, rowIndex, blankLines);
  }
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
  const total = Math.max(1, bounds.width);
  const leftW = (getMenuLineColumn(group, 'left', 0)?.width ?? total * 0.48) * (group.scaleX ?? 1);
  const centerW =
    (getMenuLineColumn(group, 'center', 0)?.width ?? total * 0.3) * (group.scaleX ?? 1);

  let key: MenuLineColumnKey = 'right';
  if (relX < leftW) key = 'left';
  else if (relX < leftW + centerW) key = 'center';

  const rowCount = getMenuLineRowCount(group);
  const rowGap = getMenuLineRowGap(group);
  let y = 0;
  for (let r = 0; r < rowCount; r++) {
    const leftBox = getMenuLineColumn(group, 'left', r);
    const dishH =
      Math.max(
        leftBox?.height ?? 0,
        getMenuLineColumn(group, 'center', r)?.height ?? 0,
        getMenuLineColumn(group, 'right', r)?.height ?? 0,
        1,
      ) * (group.scaleY ?? 1);
    const ingBox = getMenuLineColumn(group, 'ingredients', r);
    const ingText = ingBox?.text?.trim() ?? '';
    const ingH =
      ingBox && ingText && ingBox.visible !== false
        ? (ingBox.height ?? 0) * (group.scaleY ?? 1) + MENU_LINE_INGREDIENTS_GAP
        : 0;
    const blanks = getMenuLineBlankLinesAfter(group, r);
    const blankPx =
      blanks * blankLineHeightPx(leftBox?.fontSize ?? 18) * (group.scaleY ?? 1);
    const blockH = dishH + ingH + blankPx + (r < rowCount - 1 ? rowGap : 0);
    if (relY >= y && relY <= y + blockH) {
      return { rowIndex: r, key };
    }
    y += blockH;
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
    box.set({ selectable: false, evented: true, editable: true });
    if (typeof (box as Textbox & { enterEditing?: () => void }).enterEditing === 'function') {
      box.enterEditing();
      box.selectAll();
      canvas.requestRenderAll();
      return true;
    }
    syncMenuLineChildInteraction(group);
  } catch {
    syncMenuLineChildInteraction(group);
  }
  return false;
}

/** Tras salir de edición de una celda, vuelve a dejar el hit-test en el grupo. */
export function endMenuLineColumnEditing(group: Group): void {
  syncMenuLineChildInteraction(group);
  layoutMenuLineGroup(group);
}
