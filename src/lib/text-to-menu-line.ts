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

/**
 * Precio al final de línea.
 * Exige €/$ o decimales (3,00 / 3.00) para no confundir «Ingrediente 3» con un precio.
 */
const PRICE_AMOUNT =
  '(?:' +
  // 3,00 € | 3.00€ | €3,00 | 3,00
  '(?:€\\s*)?\\d{1,6}[.,]\\d{1,2}\\s*€?' +
  '|' +
  // 12 € | €12 (entero solo si lleva símbolo)
  '€\\s*\\d{1,6}(?:[.,]\\d{1,2})?' +
  '|' +
  '\\d{1,6}(?:[.,]\\d{1,2})?\\s*€' +
  '|' +
  // $12.50 | 12.50$ | $12
  '\\$\\s*\\d{1,6}(?:[.,]\\d{1,2})?' +
  '|' +
  '\\d{1,6}(?:[.,]\\d{1,2})?\\s*\\$' +
  ')';

const PRICE_AT_END = new RegExp(
  `^(.*?)(?:\\s{2,}|\\s*[·.•…]+\\s*|\\s*[-–—.−‒‑]{2,}\\s*|\\s*[-–—.−‒‑]\\s*|\\s+)(${PRICE_AMOUNT})\\s*$`,
  'u',
);

const TRAILING_FILLER = /[\s·.•…\-–—.−‒‑]{1,}$/u;

/** Separador clásico: "Mozzarella - Tomàquet - …". */
const INGREDIENT_SEP_DASH = /\s+[-–—]\s+/;
/** Separadores frecuentes en OCR / cartas: comas o punto y coma. */
const INGREDIENT_SEP_COMMA_SEMI = /\s*[,;]\s*/;
const TRAILING_INGREDIENT_PUNCT = /[,;]+\s*$/;

/** Separador canónico del campo «Ingredientes» en la herramienta. */
export const INGREDIENTS_DISPLAY_SEP = ' - ';

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

/** Normaliza puntuación final típica de listas OCR. */
export function normalizeIngredientsText(text: string): string {
  return text.replace(/\u00a0/g, ' ').trim().replace(TRAILING_INGREDIENT_PUNCT, '').trim();
}

/**
 * Trocea una línea de ingredientes por guiones, comas o punto y coma.
 * Prioriza guiones con espacios; si no hay ≥2 trozos, prueba `,` / `;`.
 */
export function splitIngredientParts(text: string): string[] {
  const t = normalizeIngredientsText(text);
  if (!t) return [];

  const dashParts = t.split(INGREDIENT_SEP_DASH).map((p) => p.trim()).filter(Boolean);
  if (dashParts.length >= 2) return dashParts;

  const commaParts = t.split(INGREDIENT_SEP_COMMA_SEMI).map((p) => p.trim()).filter(Boolean);
  if (commaParts.length >= 2) return commaParts;

  return [t];
}

/** Une ítems con el separador preestablecido de la herramienta (` - `). */
export function formatIngredientsList(parts: string[]): string {
  return parts
    .map((p) => p.replace(/\u00a0/g, ' ').trim())
    .filter(Boolean)
    .join(INGREDIENTS_DISPLAY_SEP);
}

export function hasTrailingListPunct(text: string): boolean {
  return /[,;]\s*$/.test(text.replace(/\u00a0/g, ' ').trim());
}

/**
 * Detecta líneas de ingredientes en una sola línea (sin precio; ≥2 ítems
 * separados por guiones, comas o punto y coma).
 */
export function looksLikeIngredients(text: string): boolean {
  const t = normalizeIngredientsText(text);
  if (!t) return false;
  if (PRICE_AT_END.test(t)) return false;
  return splitIngredientParts(t).length >= 2;
}

/**
 * Una línea puede formar parte de una lista de ingredientes (incl. ítems OCR
 * sueltos con coma final, o el último ítem sin coma).
 */
export function isPlausibleIngredientLine(text: string): boolean {
  const raw = text.replace(/\u00a0/g, ' ').trim();
  if (!raw) return false;
  if (PRICE_AT_END.test(raw)) return false;
  if (looksLikeIngredients(raw)) return true;
  if (hasTrailingListPunct(raw)) {
    return normalizeIngredientsText(raw).length > 0;
  }
  const t = normalizeIngredientsText(raw);
  if (!t || t.length > 60) return false;
  // Evitar líneas con líderes tipográficos (parece plato, no ingrediente).
  if (/[·•…]{2,}|\.{3,}/.test(t)) return false;
  return true;
}

/** Título de sección típico (p. ej. ENTRANTES): no es lista de ingredientes. */
export function looksLikeSectionTitle(text: string): boolean {
  const t = text.replace(/\u00a0/g, ' ').trim();
  if (!t || t.length > 40) return false;
  if (hasTrailingListPunct(t) || looksLikeIngredients(t)) return false;
  if (PRICE_AT_END.test(t)) return false;
  if (/[·•…]{2,}|\.{3,}/.test(t)) return false;
  const letters = t.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/gu, '');
  if (letters.length < 3) return false;
  const upper = letters.replace(/[^A-ZÁÉÍÓÚÜÑ]/gu, '').length;
  return upper / letters.length >= 0.85;
}

type MenuTextToken =
  | { kind: 'blank' }
  | { kind: 'content'; line: ParsedMenuTextLine };

function skipBlanks(tokens: MenuTextToken[], startIndex: number): number {
  let i = startIndex;
  while (i < tokens.length && tokens[i].kind === 'blank') i += 1;
  return i;
}

/**
 * Tras un plato+precio, recoge una o varias líneas de ingredientes
 * (permite blancos típicos del OCR entre ítems) y las normaliza a una sola
 * cadena con ` - ` para el campo «Ingredientes» — no como filas Plato.
 */
export function collectIngredientsFromTokens(
  tokens: MenuTextToken[],
  startIndex: number,
): { ingredients?: string; nextIndex: number } {
  // El OCR suele insertar una línea en blanco entre plato e ingredientes.
  const contentStart = skipBlanks(tokens, startIndex);
  if (contentStart >= tokens.length) return { nextIndex: startIndex };
  const firstTok = tokens[contentStart];
  if (firstTok.kind !== 'content' || firstTok.line.hasPrice) {
    return { nextIndex: startIndex };
  }

  const firstText = firstTok.line.left;
  if (looksLikeSectionTitle(firstText) && !looksLikeIngredients(firstText)) {
    return { nextIndex: startIndex };
  }

  // Arrancar si: lista en una línea, coma/punto y coma final, o bloque de
  // ≥2 líneas sin precio (patrón OCR “Pollo / Nueces / Legumbres”).
  const secondContent = skipBlanks(tokens, contentStart + 1);
  const hasFollowingNonPrice =
    secondContent < tokens.length &&
    tokens[secondContent].kind === 'content' &&
    !tokens[secondContent].line.hasPrice &&
    !looksLikeSectionTitle(tokens[secondContent].line.left);

  const canStart =
    looksLikeIngredients(firstText) ||
    hasTrailingListPunct(firstText) ||
    (hasFollowingNonPrice && isPlausibleIngredientLine(firstText));

  if (!canStart) return { nextIndex: startIndex };

  const collected: string[] = [];
  let i = contentStart;

  while (i < tokens.length) {
    if (tokens[i].kind === 'blank') {
      const nextContent = skipBlanks(tokens, i);
      if (nextContent >= tokens.length) break;
      const nextTok = tokens[nextContent];
      if (nextTok.kind !== 'content' || nextTok.line.hasPrice) break;
      if (looksLikeSectionTitle(nextTok.line.left) && !looksLikeIngredients(nextTok.line.left)) {
        break;
      }
      if (!isPlausibleIngredientLine(nextTok.line.left)) break;
      i = nextContent;
      continue;
    }

    const line = tokens[i].line;
    if (line.hasPrice) break;
    const text = line.left;

    if (collected.length === 0) {
      if (looksLikeSectionTitle(text) && !looksLikeIngredients(text)) break;
      collected.push(text);
      i += 1;
      continue;
    }

    if (looksLikeSectionTitle(text) && !looksLikeIngredients(text)) break;
    if (!isPlausibleIngredientLine(text)) break;

    collected.push(text);
    i += 1;
  }

  const parts = collected.flatMap((line) => splitIngredientParts(line));
  if (parts.length === 0) return { nextIndex: startIndex };

  // Una sola línea / un solo ítem sin señales de lista → no consumir.
  if (
    parts.length < 2 &&
    collected.length < 2 &&
    !hasTrailingListPunct(collected[0] ?? '') &&
    !looksLikeIngredients(collected[0] ?? '')
  ) {
    return { nextIndex: startIndex };
  }

  return {
    ingredients: formatIngredientsList(parts),
    nextIndex: i,
  };
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
 * Empareja plato+precio con la(s) línea(s) de ingredientes siguientes (si aplica).
 */
export function pairMenuTextLines(
  parsed: ParsedMenuTextLine[],
): Array<ParsedMenuTextLine & { ingredients?: string }> {
  const tokens: MenuTextToken[] = parsed.map((line) => ({ kind: 'content', line }));
  const out: Array<ParsedMenuTextLine & { ingredients?: string }> = [];
  let i = 0;
  while (i < parsed.length) {
    const current = parsed[i];
    if (current.hasPrice) {
      const collected = collectIngredientsFromTokens(tokens, i + 1);
      out.push({
        ...current,
        ...(collected.ingredients ? { ingredients: collected.ingredients } : {}),
      });
      i = collected.ingredients ? collected.nextIndex : i + 1;
      continue;
    }
    out.push({ ...current });
    i += 1;
  }
  return out;
}

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
    // Ingredientes inmediatos (misma línea multi-ítem o varias líneas OCR).
    if (current.hasPrice) {
      const collected = collectIngredientsFromTokens(tokens, i);
      if (collected.ingredients) {
        ingredients = collected.ingredients;
        i = collected.nextIndex;
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
