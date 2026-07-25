import {
  type ConverterCanvasData,
  type ConverterCharStyles,
  type ConverterImageLayer,
  type ConverterLayer,
  type ConverterMenuLineCell,
  type ConverterMenuLineLayer,
  type ConverterMenuLineRow,
  type ConverterPage,
  type ConverterShapeLayer,
  type ConverterTextLayer,
  normalizeConverterCanvasData,
} from './canvas-input';
import {
  MENU_DOCUMENT_VERSION,
  type MenuDocument,
  type MenuDocumentCharStyles,
  type MenuDocumentDividerElement,
  type MenuDocumentElement,
  type MenuDocumentImageElement,
  type MenuDocumentMenuLineCell,
  type MenuDocumentMenuLineElement,
  type MenuDocumentMenuLineRow,
  type MenuDocumentMeta,
  type MenuDocumentPage,
  type MenuDocumentShapeElement,
  type MenuDocumentTextElement,
  type Percent,
} from './types';

const DEFAULT_CANVAS_W = 595;
const DEFAULT_CANVAS_H = 842;

function toPercent(value: number, total: number): Percent {
  if (total <= 0) return 0;
  return Math.round((value / total) * 10000) / 100;
}

function inferSemantic(fontSize: number, canvasHeight: number): MenuDocumentTextElement['semantic'] {
  const ratio = fontSize / canvasHeight;
  if (ratio >= 0.045) return 'heading';
  if (ratio >= 0.028) return 'subheading';
  if (ratio <= 0.012) return 'caption';
  return 'body';
}

/** Convierte fontSize px de Fabric a % del ancho; deja el resto igual. */
function convertCharStylesToDocument(
  styles: ConverterCharStyles | undefined,
  canvasW: number,
): MenuDocumentCharStyles | undefined {
  if (!styles || typeof styles !== 'object') return undefined;
  const out: MenuDocumentCharStyles = {};
  for (const [lineKey, line] of Object.entries(styles)) {
    if (!line || typeof line !== 'object') continue;
    const outLine: Record<string, Record<string, unknown>> = {};
    for (const [charKey, style] of Object.entries(line)) {
      if (!style || typeof style !== 'object') continue;
      const next: Record<string, unknown> = { ...style };
      if (typeof next.fontSize === 'number' && Number.isFinite(next.fontSize)) {
        next.fontSize = toPercent(next.fontSize, canvasW);
      }
      outLine[charKey] = next;
    }
    if (Object.keys(outLine).length > 0) out[lineKey] = outLine;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function convertCharStylesFromDocument(
  styles: MenuDocumentCharStyles | undefined,
  canvasW: number,
): ConverterCharStyles | undefined {
  if (!styles || typeof styles !== 'object') return undefined;
  const out: ConverterCharStyles = {};
  for (const [lineKey, line] of Object.entries(styles)) {
    if (!line || typeof line !== 'object') continue;
    const outLine: Record<string, Record<string, unknown>> = {};
    for (const [charKey, style] of Object.entries(line)) {
      if (!style || typeof style !== 'object') continue;
      const next: Record<string, unknown> = { ...style };
      if (typeof next.fontSize === 'number' && Number.isFinite(next.fontSize)) {
        next.fontSize = Math.max(fromPercent(next.fontSize, canvasW), 4);
      }
      outLine[charKey] = next;
    }
    if (Object.keys(outLine).length > 0) out[lineKey] = outLine;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function convertTextLayer(
  layer: ConverterTextLayer,
  canvasW: number,
  canvasH: number,
): MenuDocumentTextElement {
  const charStyles = convertCharStylesToDocument(layer.charStyles, canvasW);
  const border = layer.style.border;
  const borderDoc =
    border &&
    border.style !== 'none' &&
    typeof border.width === 'number' &&
    border.width > 0
      ? {
          style: border.style,
          color: border.color || '#333333',
          width: toPercent(border.width, canvasW),
          radius: toPercent(border.radius ?? 0, canvasW),
          margin: toPercent(border.margin ?? border.padding ?? 0, canvasW),
        }
      : undefined;

  return {
    id: layer.id,
    type: 'text',
    text: layer.content,
    x: toPercent(layer.x, canvasW),
    y: toPercent(layer.y, canvasH),
    width: toPercent(layer.width, canvasW),
    height: toPercent(layer.height, canvasH),
    rotation: layer.rotation,
    opacity: layer.opacity ?? layer.style.opacity,
    zIndex: layer.zIndex,
    semantic: inferSemantic(layer.style.fontSize, canvasH),
    ...(charStyles ? { charStyles } : {}),
    style: {
      fontFamily: layer.style.fontFamily,
      fontSize: toPercent(layer.style.fontSize, canvasW),
      fontWeight: layer.style.fontWeight,
      fontStyle: layer.style.fontStyle,
      lineHeight: 1.2,
      letterSpacing: 0,
      textAlign: layer.style.align,
      textTransform: 'none',
      color: layer.style.color,
      ...(borderDoc ? { border: borderDoc } : {}),
    },
  };
}

function convertImageLayer(
  layer: ConverterImageLayer,
  canvasW: number,
  canvasH: number,
): MenuDocumentImageElement {
  return {
    id: layer.id,
    type: 'image',
    src: layer.src,
    alt: '',
    objectFit: 'cover',
    x: toPercent(layer.x, canvasW),
    y: toPercent(layer.y, canvasH),
    width: toPercent(layer.width, canvasW),
    height: toPercent(layer.height, canvasH),
    rotation: layer.rotation,
    opacity: layer.opacity,
    zIndex: layer.zIndex,
  };
}

function convertShapeLayer(
  layer: ConverterShapeLayer,
  canvasW: number,
  canvasH: number,
): MenuDocumentShapeElement | MenuDocumentDividerElement | null {
  if (layer.shape === 'line') {
    const thickness = layer.style.strokeWidth ?? 1;
    return {
      id: layer.id,
      type: 'divider',
      color: layer.style.stroke ?? '#000000',
      thickness: toPercent(thickness, canvasW),
      x: toPercent(layer.x, canvasW),
      y: toPercent(layer.y, canvasH),
      width: toPercent(Math.max(layer.width, 1), canvasW),
      height: toPercent(thickness, canvasH),
      rotation: layer.rotation,
      opacity: layer.opacity ?? layer.style.opacity,
      zIndex: layer.zIndex,
    };
  }

  return {
    id: layer.id,
    type: 'shape',
    shape: layer.shape === 'circle' ? 'circle' : 'rect',
    fill: layer.style.fill,
    stroke: layer.style.stroke,
    strokeWidth: layer.style.strokeWidth
      ? toPercent(layer.style.strokeWidth, canvasW)
      : undefined,
    x: toPercent(layer.x, canvasW),
    y: toPercent(layer.y, canvasH),
    width: toPercent(layer.width, canvasW),
    height: toPercent(layer.height, canvasH),
    rotation: layer.rotation,
    opacity: layer.opacity ?? layer.style.opacity,
    zIndex: layer.zIndex,
  };
}

function convertMenuLineCell(
  cell: ConverterMenuLineCell,
  canvasW: number,
): MenuDocumentMenuLineCell {
  return {
    content: typeof cell.content === 'string' ? cell.content : '',
    style: {
      fontFamily: cell.style?.fontFamily || 'Arial',
      fontSize: toPercent(Math.max(cell.style?.fontSize ?? 16, 4), canvasW),
      color: cell.style?.color || '#333333',
      align: cell.style?.align === 'center' || cell.style?.align === 'right' ? cell.style.align : 'left',
      fontWeight: cell.style?.fontWeight,
      fontStyle: cell.style?.fontStyle,
    },
  };
}

function convertMenuLineRow(
  row: ConverterMenuLineRow,
  canvasW: number,
): MenuDocumentMenuLineRow {
  const out: MenuDocumentMenuLineRow = {
    left: convertMenuLineCell(row.left, canvasW),
    center: convertMenuLineCell(row.center, canvasW),
    right: convertMenuLineCell(row.right, canvasW),
  };
  if (row.ingredients && typeof row.ingredients === 'object') {
    out.ingredients = convertMenuLineCell(row.ingredients, canvasW);
  }
  if (
    typeof row.blankLinesAfter === 'number' &&
    Number.isFinite(row.blankLinesAfter) &&
    row.blankLinesAfter > 0
  ) {
    out.blankLinesAfter = Math.round(row.blankLinesAfter);
  }
  if (
    row.leader === 'dots' ||
    row.leader === 'dashes' ||
    row.leader === 'spaces' ||
    row.leader === 'custom'
  ) {
    out.leader = row.leader;
  }
  return out;
}

function convertMenuLineLayer(
  layer: ConverterMenuLineLayer,
  canvasW: number,
  canvasH: number,
): MenuDocumentMenuLineElement | null {
  const rows = Array.isArray(layer.rows) ? layer.rows : [];
  if (rows.length === 0) return null;

  const blockW = Math.max(layer.width, 1);
  const leftWidth =
    typeof layer.leftWidth === 'number' && layer.leftWidth > 0
      ? layer.leftWidth
      : layer.columnRatios?.left
        ? layer.columnRatios.left * blockW
        : blockW * 0.48;

  return {
    id: layer.id,
    type: 'menuLine',
    ...(typeof layer.name === 'string' && layer.name.trim()
      ? { name: layer.name.trim() }
      : {}),
    leader:
      layer.leader === 'dashes' ||
      layer.leader === 'spaces' ||
      layer.leader === 'custom'
        ? layer.leader
        : 'dots',
    leftWidthRatio: toPercent(leftWidth, blockW),
    ...(typeof layer.rowGap === 'number' && layer.rowGap >= 0
      ? { rowGap: toPercent(layer.rowGap, canvasH) }
      : {}),
    x: toPercent(layer.x, canvasW),
    y: toPercent(layer.y, canvasH),
    width: toPercent(layer.width, canvasW),
    height: toPercent(layer.height, canvasH),
    rotation: layer.rotation,
    opacity: layer.opacity,
    zIndex: layer.zIndex,
    rows: rows.map((row) => convertMenuLineRow(row, canvasW)),
  };
}

function convertLayer(
  layer: ConverterLayer,
  canvasW: number,
  canvasH: number,
): MenuDocumentElement | null {
  if (layer.visible === false) return null;

  if (layer.type === 'text') {
    return convertTextLayer(layer, canvasW, canvasH);
  }
  if (layer.type === 'image') {
    return convertImageLayer(layer, canvasW, canvasH);
  }
  if (layer.type === 'shape') {
    return convertShapeLayer(layer, canvasW, canvasH);
  }
  if (layer.type === 'menuLine') {
    return convertMenuLineLayer(layer, canvasW, canvasH);
  }
  return null;
}

function convertPage(page: ConverterPage, canvasW: number, canvasH: number): MenuDocumentPage {
  const backgroundColor =
    page.background.type === 'color' ? page.background.value : '#FAF6F0';

  const elements = [...page.layers]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((layer) => convertLayer(layer, canvasW, canvasH))
    .filter((el): el is MenuDocumentElement => el !== null);

  return {
    id: page.id,
    canvas: {
      width: canvasW,
      height: canvasH,
      background: backgroundColor,
      ...(page.background.type === 'image' && page.background.value
        ? { backgroundImage: page.background.value }
        : {}),
    },
    elements,
  };
}

export function canvasDataToMenuDocument(
  raw: unknown,
  meta?: MenuDocumentMeta,
): MenuDocument | null {
  const data = normalizeConverterCanvasData(raw);
  if (!data || data.pages.length === 0) return null;

  const canvasW = data.width || DEFAULT_CANVAS_W;
  const canvasH = data.height || DEFAULT_CANVAS_H;

  return {
    version: MENU_DOCUMENT_VERSION,
    meta: meta
      ? { ...meta, exportedAt: meta.exportedAt ?? new Date().toISOString() }
      : { exportedAt: new Date().toISOString() },
    pages: data.pages.map((page) => {
      const pageW =
        typeof page.width === 'number' && page.width > 0 ? page.width : canvasW;
      const pageH =
        typeof page.height === 'number' && page.height > 0 ? page.height : canvasH;
      return convertPage(page, pageW, pageH);
    }),
  };
}

export function menuDocumentFromCanvasData(
  data: ConverterCanvasData,
  meta?: MenuDocumentMeta,
): MenuDocument | null {
  return canvasDataToMenuDocument(data, meta);
}

export function serializeMenuDocument(doc: MenuDocument): string {
  return JSON.stringify(doc);
}

export function parseMenuDocument(raw: unknown): MenuDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (d.version !== MENU_DOCUMENT_VERSION) return null;
  if (!Array.isArray(d.pages) || d.pages.length === 0) return null;

  const pagesValid = d.pages.every((p) => {
    if (!p || typeof p !== 'object') return false;
    const page = p as Record<string, unknown>;
    return (
      typeof page.id === 'string' &&
      page.canvas !== null &&
      typeof page.canvas === 'object' &&
      Array.isArray(page.elements)
    );
  });

  if (!pagesValid) return null;
  return d as unknown as MenuDocument;
}

function fromPercent(pct: number, total: number): number {
  if (!Number.isFinite(pct) || total <= 0) return 0;
  return (pct / 100) * total;
}

function elementToLayer(
  el: MenuDocumentElement,
  canvasW: number,
  canvasH: number,
): ConverterLayer | null {
  const base = {
    id: el.id,
    x: fromPercent(el.x, canvasW),
    y: fromPercent(el.y, canvasH),
    width: Math.max(fromPercent(el.width, canvasW), 1),
    height: Math.max(fromPercent(el.height, canvasH), 1),
    rotation: el.rotation ?? 0,
    zIndex: typeof el.zIndex === 'number' ? el.zIndex : 1,
    opacity: el.opacity,
  };

  if (el.type === 'text') {
    const charStyles = convertCharStylesFromDocument(el.charStyles, canvasW);
    const border =
      el.style.border &&
      el.style.border.style !== 'none' &&
      el.style.border.width > 0
        ? {
            style: el.style.border.style,
            color: el.style.border.color || '#333333',
            width: Math.max(fromPercent(el.style.border.width, canvasW), 0.5),
            radius: Math.max(fromPercent(el.style.border.radius ?? 0, canvasW), 0),
            margin: Math.max(
              fromPercent(
                el.style.border.margin ?? el.style.border.padding ?? 0,
                canvasW,
              ),
              0,
            ),
          }
        : undefined;
    return {
      ...base,
      type: 'text',
      content: el.text,
      ...(charStyles ? { charStyles } : {}),
      style: {
        fontFamily: el.style.fontFamily || 'Arial',
        fontSize: Math.max(fromPercent(el.style.fontSize, canvasW), 8),
        color: el.style.color || '#1a1a1a',
        align: el.style.textAlign || 'left',
        fontWeight: el.style.fontWeight,
        fontStyle: el.style.fontStyle,
        ...(border ? { border } : {}),
      },
    };
  }

  if (el.type === 'image') {
    return {
      ...base,
      type: 'image',
      src: el.src,
    };
  }

  if (el.type === 'shape') {
    return {
      ...base,
      type: 'shape',
      shape: el.shape === 'circle' ? 'circle' : 'rect',
      style: {
        fill: el.fill,
        stroke: el.stroke,
        strokeWidth: el.strokeWidth
          ? Math.max(fromPercent(el.strokeWidth, canvasW), 0)
          : undefined,
        opacity: el.opacity,
      },
    };
  }

  if (el.type === 'divider') {
    const thickness = Math.max(fromPercent(el.thickness, canvasW), 1);
    return {
      ...base,
      type: 'shape',
      shape: 'line',
      height: thickness,
      style: {
        stroke: el.color || '#000000',
        strokeWidth: thickness,
        opacity: el.opacity,
      },
    };
  }

  if (el.type === 'menuLine') {
    return menuLineElementToLayer(el, canvasW, canvasH, base);
  }

  return null;
}

function menuLineCellFromDocument(
  cell: MenuDocumentMenuLineCell,
  canvasW: number,
): ConverterMenuLineCell {
  return {
    content: typeof cell.content === 'string' ? cell.content : '',
    style: {
      fontFamily: cell.style?.fontFamily || 'Arial',
      fontSize: Math.max(fromPercent(cell.style?.fontSize ?? 2.5, canvasW), 8),
      color: cell.style?.color || '#333333',
      align:
        cell.style?.align === 'center' || cell.style?.align === 'right'
          ? cell.style.align
          : 'left',
      fontWeight: cell.style?.fontWeight,
      fontStyle: cell.style?.fontStyle,
    },
  };
}

function menuLineElementToLayer(
  el: MenuDocumentMenuLineElement,
  canvasW: number,
  canvasH: number,
  base: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    zIndex: number;
    opacity?: number;
  },
): ConverterMenuLineLayer | null {
  const rowsIn = Array.isArray(el.rows) ? el.rows : [];
  if (rowsIn.length === 0) return null;

  const blockW = Math.max(base.width, 1);
  const leftRatio =
    typeof el.leftWidthRatio === 'number' && Number.isFinite(el.leftWidthRatio)
      ? Math.min(Math.max(el.leftWidthRatio, 5), 90) / 100
      : 0.48;
  const leftWidth = Math.round(blockW * leftRatio);
  const rowGap =
    typeof el.rowGap === 'number' && Number.isFinite(el.rowGap)
      ? Math.max(0, fromPercent(el.rowGap, canvasH))
      : 6;

  const rows: ConverterMenuLineRow[] = rowsIn.map((row) => {
    const out: ConverterMenuLineRow = {
      left: menuLineCellFromDocument(row.left, canvasW),
      center: menuLineCellFromDocument(row.center, canvasW),
      right: menuLineCellFromDocument(row.right, canvasW),
    };
    if (row.ingredients) {
      out.ingredients = menuLineCellFromDocument(row.ingredients, canvasW);
    }
    if (
      typeof row.blankLinesAfter === 'number' &&
      Number.isFinite(row.blankLinesAfter) &&
      row.blankLinesAfter > 0
    ) {
      out.blankLinesAfter = Math.round(row.blankLinesAfter);
    }
    if (
      row.leader === 'dots' ||
      row.leader === 'dashes' ||
      row.leader === 'spaces' ||
      row.leader === 'custom'
    ) {
      out.leader = row.leader;
    }
    return out;
  });

  return {
    ...base,
    type: 'menuLine',
    ...(typeof el.name === 'string' && el.name.trim() ? { name: el.name.trim() } : {}),
    leader:
      el.leader === 'dashes' || el.leader === 'spaces' || el.leader === 'custom'
        ? el.leader
        : 'dots',
    leftWidth,
    columnRatios: {
      left: leftRatio,
      center: Math.max(0.1, (1 - leftRatio) * 0.55),
      right: Math.max(0.1, (1 - leftRatio) * 0.45),
    },
    rows,
    rowGap,
  };
}

/** Convierte un MenuDocument exportado de vuelta a CanvasData del editor. */
export function menuDocumentToCanvasData(doc: MenuDocument): ConverterCanvasData {
  const first = doc.pages[0];
  const width = first?.canvas?.width || DEFAULT_CANVAS_W;
  const height = first?.canvas?.height || DEFAULT_CANVAS_H;

  const pages = doc.pages.map((page, index) => {
    const canvasW = page.canvas?.width || width;
    const canvasH = page.canvas?.height || height;
    const layers = page.elements
      .map((el) => elementToLayer(el, canvasW, canvasH))
      .filter((layer): layer is ConverterLayer => layer !== null)
      .sort((a, b) => a.zIndex - b.zIndex);

    const bgImage = page.canvas?.backgroundImage;
    return {
      id: page.id || `page_${index + 1}`,
      background: bgImage
        ? { type: 'image' as const, value: bgImage }
        : {
            type: 'color' as const,
            value: page.canvas?.background || '#FAF6F0',
          },
      layers,
      width: canvasW,
      height: canvasH,
    };
  });

  return { width, height, pages };
}

/**
 * Acepta menu.json (MenuDocument v1) o CanvasData del editor.
 * Devuelve null si el JSON no es reconocible.
 */
export function importJsonToCanvasData(raw: unknown): ConverterCanvasData | null {
  const doc = parseMenuDocument(raw);
  if (doc) return menuDocumentToCanvasData(doc);

  const normalized = normalizeConverterCanvasData(raw);
  if (normalized && normalized.pages.length > 0) return normalized;
  return null;
}
