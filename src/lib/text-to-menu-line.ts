import { Canvas, Textbox, type FabricObject, type Group } from 'fabric';
import { isTextObject } from '@/lib/canvas-serializer';
import { getLayerObjectData, setLayerObjectData } from '@/lib/layer-utils';
import {
  MENU_LINE_DEFAULT_ROW_GAP,
  MENU_LINE_MAX_BLANK_LINES,
  MENU_LINE_MIN_TOTAL,
  measureTextContentWidth,
  menuLineLayerToGroup,
} from '@/lib/menu-line';
import type {
  MenuLineColumnStyle,
  MenuLineLayer,
  MenuLineLeader,
  MenuLineRow,
} from '@/types/canvas';

/** Precio al final de línea (€ / $ / número con decimales). */
const PRICE_AT_END =
  /^(.*?)(?:\s{2,}|\s*[·.•…]+\s*|\s*[-–—.]{2,}\s*|\s+)((?:€\s*)?\d{1,6}(?:[.,]\d{1,2})?\s*€?|\$\s*\d{1,6}(?:[.,]\d{1,2})?)\s*$/u;

const TRAILING_FILLER = /[\s·.•…\-–—.]{2,}$/u;

/** Separador típico entre ingredientes: "Mozzarella - Tomàquet - …". */
const INGREDIENT_SEP = /\s+[-–—]\s+/;

export interface ParsedMenuTextLine {
  left: string;
  right: string;
  leader: MenuLineLeader;
  /** true si se detectó precio al final */
  hasPrice: boolean;
}

/**
 * Parte una línea de menú en plato + precio.
 * Acepta espacios múltiples, puntos líderes o guiones antes del precio.
 */
export function parseMenuTextLine(rawLine: string): ParsedMenuTextLine | null {
  const line = rawLine.replace(/\u00a0/g, ' ').trim();
  if (!line) return null;

  const match = line.match(PRICE_AT_END);
  if (match) {
    let left = (match[1] ?? '').trim().replace(TRAILING_FILLER, '').trim();
    const right = (match[2] ?? '').trim();
    if (!left) left = right; // solo precio
    const between = line.slice(match[1]?.length ?? 0, line.length - (match[2]?.length ?? 0));
    const leader = detectLeaderFromFiller(between);
    return { left, right, leader, hasPrice: true };
  }

  // Sin precio reconocible: toda la línea es el plato.
  return {
    left: line,
    right: '',
    leader: 'dots',
    hasPrice: false,
  };
}

/**
 * Detecta líneas de ingredientes bajo un plato (sin precio, ítems separados por guiones).
 * No hace falta marcarlas a mano: se emparejan con la fila de plato+precio anterior.
 */
export function looksLikeIngredients(text: string): boolean {
  const t = text.replace(/\u00a0/g, ' ').trim().replace(/,+\s*$/, '');
  if (!t) return false;
  // Si parece una línea con precio, no es lista de ingredientes.
  if (PRICE_AT_END.test(t)) return false;
  const parts = t.split(INGREDIENT_SEP).map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2;
}

function detectLeaderFromFiller(filler: string): MenuLineLeader {
  const s = filler.replace(/\s+/g, '');
  if (/[·.•…]/.test(s)) return 'dots';
  if (/[-–—]/.test(s)) return 'dashes';
  if (/\.{2,}/.test(s)) return 'dots';
  return 'spaces';
}

function styleFromTextbox(text: Textbox): MenuLineColumnStyle {
  const fill =
    typeof text.fill === 'string' &&
    text.fill !== '' &&
    text.fill !== 'transparent' &&
    text.fill !== 'rgba(0,0,0,0)'
      ? text.fill
      : '#333333';

  return {
    fontFamily: text.fontFamily || 'Arial',
    fontSize: Math.max(8, Number(text.fontSize) || 18),
    color: fill,
    align: 'left',
    fontWeight: String(text.fontWeight ?? 'normal'),
    fontStyle:
      text.fontStyle === 'italic' || text.fontStyle === 'oblique'
        ? text.fontStyle
        : 'normal',
  };
}

function defaultIngredientsStyle(base: MenuLineColumnStyle): MenuLineColumnStyle {
  return {
    ...base,
    align: 'left',
    fontSize: Math.max(8, base.fontSize - 3),
    color: '#666666',
    fontWeight: 'normal',
  };
}

/**
 * Empareja plato+precio con la línea de ingredientes siguiente (si aplica).
 */
export function pairMenuTextLines(
  parsed: ParsedMenuTextLine[],
): Array<ParsedMenuTextLine & { ingredients?: string }> {
  const out: Array<ParsedMenuTextLine & { ingredients?: string }> = [];
  let i = 0;
  while (i < parsed.length) {
    const current = parsed[i];
    const next = parsed[i + 1];
    if (
      current.hasPrice &&
      next &&
      !next.hasPrice &&
      looksLikeIngredients(next.left)
    ) {
      out.push({ ...current, ingredients: next.left.replace(/,+\s*$/, '').trim() });
      i += 2;
      continue;
    }
    out.push({ ...current });
    i += 1;
  }
  return out;
}

type MenuTextToken =
  | { kind: 'blank' }
  | { kind: 'content'; line: ParsedMenuTextLine };

export type PairedMenuTextRow = ParsedMenuTextLine & {
  ingredients?: string;
  /** Líneas en blanco tras el plato (e ingredientes), antes del siguiente. */
  blankLinesAfter: number;
};

/**
 * Parsea el texto completo conservando líneas en blanco entre platos.
 * Los saltos van después del bloque plato (+ ingredientes si están pegados debajo).
 */
export function parseMenuTextBlocks(raw: string): PairedMenuTextRow[] {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const tokens: MenuTextToken[] = lines.map((rawLine) => {
    if (!rawLine.replace(/\u00a0/g, ' ').trim()) return { kind: 'blank' };
    const line = parseMenuTextLine(rawLine);
    if (!line) return { kind: 'blank' };
    return { kind: 'content', line };
  });

  const out: PairedMenuTextRow[] = [];
  let i = 0;
  while (i < tokens.length && tokens[i].kind === 'blank') i += 1;

  while (i < tokens.length) {
    const token = tokens[i];
    if (token.kind === 'blank') {
      i += 1;
      continue;
    }

    const current = token.line;
    i += 1;

    let ingredients: string | undefined;
    // Ingredientes solo si la siguiente línea de contenido es inmediata (sin blancos).
    const nextToken = tokens[i];
    if (
      current.hasPrice &&
      nextToken &&
      nextToken.kind === 'content'
    ) {
      const next = nextToken.line;
      if (!next.hasPrice && looksLikeIngredients(next.left)) {
        ingredients = next.left.replace(/,+\s*$/, '').trim();
        i += 1;
      }
    }

    let blankLinesAfter = 0;
    while (i < tokens.length && tokens[i].kind === 'blank') {
      blankLinesAfter += 1;
      i += 1;
    }

    out.push({
      ...current,
      ...(ingredients ? { ingredients } : {}),
      blankLinesAfter: Math.min(MENU_LINE_MAX_BLANK_LINES, blankLinesAfter),
    });
  }

  return out;
}

/** ¿La selección activa es un único texto convertible? */
export function canConvertTextToMenuLine(canvas: Canvas | null): boolean {
  if (!canvas) return false;
  const active = canvas.getActiveObjects();
  if (active.length !== 1) return false;
  const obj = active[0];
  if (!isTextObject(obj)) return false;
  if (getLayerObjectData(obj).menuLineRole) return false;
  const text = (obj as Textbox).text ?? '';
  return text.trim().length > 0;
}

/**
 * Construye la capa menuLine a partir de un Textbox (sin tocar el canvas).
 */
export function buildMenuLineLayerFromTextbox(text: Textbox): MenuLineLayer | null {
  const raw = (text.text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const paired = parseMenuTextBlocks(raw);

  if (paired.length === 0) return null;

  const base = styleFromTextbox(text);
  const leftStyle: MenuLineColumnStyle = { ...base, align: 'left' };
  const centerStyle: MenuLineColumnStyle = {
    ...base,
    align: 'center',
    color: '#888888',
    fontSize: Math.max(8, base.fontSize - 2),
  };
  const rightStyle: MenuLineColumnStyle = {
    ...base,
    align: 'right',
    fontWeight: 'bold',
  };
  const ingredientsStyle = defaultIngredientsStyle(base);

  const leaders = paired.map((p) => p.leader);
  const defaultLeader: MenuLineLeader = leaders.includes('dots')
    ? 'dots'
    : leaders.includes('dashes')
      ? 'dashes'
      : leaders.includes('spaces')
        ? 'spaces'
        : 'dots';

  const rows: MenuLineRow[] = paired.map((p) => {
    const row: MenuLineRow = {
      left: { content: p.left, style: { ...leftStyle } },
      center: { content: '', style: { ...centerStyle } },
      right: { content: p.right || '—', style: { ...rightStyle } },
      leader: p.hasPrice ? p.leader : defaultLeader,
    };
    if (p.ingredients) {
      row.ingredients = {
        content: p.ingredients,
        style: { ...ingredientsStyle },
      };
    }
    if (p.blankLinesAfter > 0) {
      row.blankLinesAfter = p.blankLinesAfter;
    }
    return row;
  });

  const boxWidth = Math.max(
    MENU_LINE_MIN_TOTAL,
    Math.round((text.width ?? 0) * (text.scaleX ?? 1)),
    Math.round(text.getBoundingRect().width),
  );

  let maxDish = MENU_LINE_MIN_TOTAL * 0.4;
  for (const row of rows) {
    maxDish = Math.max(maxDish, measureTextContentWidth(row.left.content, row.left.style));
  }
  const leftWidth = Math.min(
    Math.max(40, Math.ceil(maxDish) + 8),
    Math.max(40, boxWidth - 80),
  );

  const data = getLayerObjectData(text);

  return {
    id: data.layerId ?? `layer_${crypto.randomUUID().slice(0, 8)}`,
    type: 'menuLine',
    name: data.layerName?.trim() || 'Línea de carta',
    x: text.left ?? 0,
    y: text.top ?? 0,
    width: boxWidth,
    height: Math.max(28, Math.round((text.height ?? 28) * (text.scaleY ?? 1))),
    rotation: text.angle ?? 0,
    zIndex: 1,
    visible: text.visible !== false,
    locked: text.selectable === false,
    opacity: text.opacity ?? 1,
    leader: defaultLeader,
    leftWidth,
    columnRatios: {
      left: leftWidth / boxWidth,
      center: Math.max(0.1, ((boxWidth - leftWidth) * 0.55) / boxWidth),
      right: Math.max(0.1, ((boxWidth - leftWidth) * 0.45) / boxWidth),
    },
    rows,
    rowGap: MENU_LINE_DEFAULT_ROW_GAP,
  };
}

/**
 * Sustituye el Textbox activo por un grupo línea de carta.
 * Devuelve el grupo creado o null si no aplica.
 */
export function convertTextObjectToMenuLine(
  canvas: Canvas,
  obj?: FabricObject | null,
): Group | null {
  const target = obj ?? canvas.getActiveObject();
  if (!target || !isTextObject(target)) return null;
  if (getLayerObjectData(target).menuLineRole) return null;

  const text = target as Textbox;
  const layer = buildMenuLineLayerFromTextbox(text);
  if (!layer) return null;

  const group = menuLineLayerToGroup(layer);
  setLayerObjectData(group, {
    layerId: layer.id,
    layerType: 'menuLine',
    layerName: layer.name,
  });

  canvas.discardActiveObject();
  canvas.remove(text);
  canvas.add(group);
  canvas.setActiveObject(group);
  canvas.requestRenderAll();
  return group;
}
