import type { Textbox } from 'fabric';
import { textboxHasSelection } from '@/lib/text-char-styles';

export type TextListMode = 'bullet' | 'number';

const BULLET_PREFIX = '• ';
const BULLET_RE = /^\s*[•◦▪]\s+/;
const NUMBER_RE = /^\s*\d+[.)]\s+/;
const INDENT_UNIT = '  ';

function stripListPrefix(line: string): string {
  return line.replace(BULLET_RE, '').replace(NUMBER_RE, '');
}

function hasBulletPrefix(line: string): boolean {
  return BULLET_RE.test(line);
}

function hasNumberPrefix(line: string): boolean {
  return NUMBER_RE.test(line);
}

/** Índices de inicio de cada línea en el texto. */
export function getLineStartIndexes(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function expandToLineBounds(
  text: string,
  start: number,
  end: number,
): { start: number; end: number } {
  let s = Math.max(0, Math.min(start, text.length));
  let e = Math.max(s, Math.min(end, text.length));
  while (s > 0 && text[s - 1] !== '\n') s -= 1;
  if (e > s && text[e - 1] === '\n') {
    e -= 1;
  }
  while (e < text.length && text[e] !== '\n') e += 1;
  return { start: s, end: e };
}

function linesInRange(
  text: string,
  start: number,
  end: number,
): Array<{ start: number; end: number; content: string }> {
  const bounds = expandToLineBounds(text, start, end);
  const slice = text.slice(bounds.start, bounds.end);
  const parts = slice.split('\n');
  const lines: Array<{ start: number; end: number; content: string }> = [];
  let cursor = bounds.start;
  for (let i = 0; i < parts.length; i += 1) {
    const content = parts[i];
    const lineEnd = cursor + content.length;
    lines.push({ start: cursor, end: lineEnd, content });
    cursor = lineEnd + (i < parts.length - 1 ? 1 : 0);
  }
  return lines;
}

function resolveTargetRange(
  textbox: Textbox,
  storedSelection: { start: number; end: number } | null,
): { start: number; end: number } {
  const full = textbox.text ?? '';
  const liveStart = textbox.selectionStart ?? 0;
  const liveEnd = textbox.selectionEnd ?? 0;
  if (textboxHasSelection(textbox) && liveEnd > liveStart) {
    return expandToLineBounds(full, liveStart, liveEnd);
  }
  if (storedSelection && storedSelection.end > storedSelection.start) {
    return expandToLineBounds(full, storedSelection.start, storedSelection.end);
  }
  return { start: 0, end: full.length };
}

/** ¿El rango (o todo el texto) ya está en modo lista? */
export function getTextListState(
  textbox: Textbox,
  storedSelection: { start: number; end: number } | null = null,
): { bullet: boolean; number: boolean } {
  const full = textbox.text ?? '';
  if (!full.trim()) return { bullet: false, number: false };
  const range = resolveTargetRange(textbox, storedSelection);
  const lines = linesInRange(full, range.start, range.end).filter((l) => l.content.trim());
  if (lines.length === 0) return { bullet: false, number: false };
  return {
    bullet: lines.every((l) => hasBulletPrefix(l.content)),
    number: lines.every((l) => hasNumberPrefix(l.content)),
  };
}

function formatBulletLine(line: string): string {
  const leading = line.match(/^\s*/)?.[0] ?? '';
  const bare = stripListPrefix(line.trimStart());
  if (!bare.trim()) return leading;
  return `${leading}${BULLET_PREFIX}${bare}`;
}

function formatNumberLine(line: string, index: number): string {
  const leading = line.match(/^\s*/)?.[0] ?? '';
  const bare = stripListPrefix(line.trimStart());
  if (!bare.trim()) return leading;
  return `${leading}${index}. ${bare}`;
}

function remapStylesOutsideRange(
  textbox: Textbox,
  full: string,
  range: { start: number; end: number },
  nextPartsLen: number,
  prevPartsLen: number,
): Record<string, Record<string, Record<string, unknown>>> {
  const styles = (textbox.styles ?? {}) as Record<
    string,
    Record<string, Record<string, unknown>>
  >;
  const lineStarts = getLineStartIndexes(full);
  const firstLine = lineStarts.findIndex((s, i) => {
    const next = lineStarts[i + 1] ?? full.length + 1;
    return range.start >= s && range.start < next;
  });
  const lastLine = lineStarts.findIndex((s, i) => {
    const next = lineStarts[i + 1] ?? full.length + 1;
    return range.end > s && range.end <= next;
  });
  const fromLine = firstLine < 0 ? 0 : firstLine;
  const toLine = lastLine < 0 ? lineStarts.length - 1 : lastLine;
  const deltaLines = nextPartsLen - prevPartsLen;

  const nextStyles: Record<string, Record<string, Record<string, unknown>>> = {};
  for (const [lineKey, chars] of Object.entries(styles)) {
    const lineIdx = Number(lineKey);
    if (!Number.isFinite(lineIdx)) continue;
    if (lineIdx < fromLine) {
      nextStyles[lineKey] = chars;
    } else if (lineIdx > toLine) {
      nextStyles[String(lineIdx + deltaLines)] = chars;
    }
  }
  return nextStyles;
}

/**
 * Convierte (o quita) viñetas/numeración en la selección ampliada a líneas,
 * o en todo el cuadro si no hay selección.
 * Deja el cursor al final del tramo (sin dejar todo seleccionado).
 */
export function toggleTextList(
  textbox: Textbox,
  mode: TextListMode,
  storedSelection: { start: number; end: number } | null = null,
): { start: number; end: number } {
  const full = textbox.text ?? '';
  const range = resolveTargetRange(textbox, storedSelection);
  const lines = linesInRange(full, range.start, range.end);
  const contentLines = lines.filter((l) => l.content.trim());
  const already =
    mode === 'bullet'
      ? contentLines.length > 0 && contentLines.every((l) => hasBulletPrefix(l.content))
      : contentLines.length > 0 && contentLines.every((l) => hasNumberPrefix(l.content));

  let numberIndex = 1;
  const nextParts = lines.map((line) => {
    if (!line.content.trim()) return line.content;
    if (already) {
      const leading = line.content.match(/^\s*/)?.[0] ?? '';
      return leading + stripListPrefix(line.content.trimStart());
    }
    if (mode === 'bullet') return formatBulletLine(line.content);
    const formatted = formatNumberLine(line.content, numberIndex);
    numberIndex += 1;
    return formatted;
  });

  const nextSegment = nextParts.join('\n');
  const nextText = full.slice(0, range.start) + nextSegment + full.slice(range.end);
  const nextStyles = remapStylesOutsideRange(
    textbox,
    full,
    range,
    nextParts.length,
    lines.length,
  );

  textbox.set({
    text: nextText,
    styles: nextStyles,
    dirty: true,
  });
  textbox.initDimensions();
  textbox.setCoords();

  const newEnd = range.start + nextSegment.length;
  // Cursor al final: si se deja todo seleccionado, el siguiente tecleo borra las viñetas.
  if (textbox.isEditing) {
    textbox.setSelectionStart(newEnd);
    textbox.setSelectionEnd(newEnd);
  }
  textbox.canvas?.requestRenderAll();
  return { start: newEnd, end: newEnd };
}

/**
 * Tras un Enter, si la línea anterior era lista, continúa viñeta/número en la nueva.
 * Si la anterior era un ítem vacío (solo prefijo), sale de la lista (comportamiento tipo Word).
 */
export function continueListPrefixIfNeeded(textbox: Textbox): boolean {
  if (!textbox.isEditing) return false;
  const full = textbox.text ?? '';
  const caret = textbox.selectionStart ?? 0;
  const caretEnd = textbox.selectionEnd ?? caret;
  if (caretEnd !== caret) return false;
  if (caret <= 0 || full[caret - 1] !== '\n') return false;

  const prevEnd = caret - 1;
  let prevStart = prevEnd;
  while (prevStart > 0 && full[prevStart - 1] !== '\n') prevStart -= 1;
  const prevLine = full.slice(prevStart, prevEnd);

  let currEnd = full.indexOf('\n', caret);
  if (currEnd < 0) currEnd = full.length;
  const currLine = full.slice(caret, currEnd);
  if (currLine.length > 0) return false;

  const prevBare = stripListPrefix(prevLine.trimStart());
  const prevHasBullet = hasBulletPrefix(prevLine);
  const numberMatch = prevLine.match(/^(\s*)(\d+)[.)]\s+/);

  // Enter sobre ítem vacío → quitar prefijo de la línea anterior y no continuar.
  if ((prevHasBullet || numberMatch) && !prevBare.trim()) {
    const leading = prevLine.match(/^\s*/)?.[0] ?? '';
    const nextText = full.slice(0, prevStart) + leading + full.slice(prevEnd);
    const newCaret = prevStart + leading.length;
    textbox.set({ text: nextText, dirty: true });
    textbox.initDimensions();
    textbox.setCoords();
    textbox.setSelectionStart(newCaret);
    textbox.setSelectionEnd(newCaret);
    textbox.canvas?.requestRenderAll();
    return true;
  }

  let prefix = '';
  if (prevHasBullet) {
    const leading = prevLine.match(/^\s*/)?.[0] ?? '';
    prefix = `${leading}${BULLET_PREFIX}`;
  } else if (numberMatch) {
    const leading = numberMatch[1] ?? '';
    prefix = `${leading}${Number(numberMatch[2]) + 1}. `;
  } else {
    return false;
  }

  const nextText = full.slice(0, caret) + prefix + full.slice(caret);
  const newCaret = caret + prefix.length;
  textbox.set({ text: nextText, dirty: true });
  textbox.initDimensions();
  textbox.setCoords();
  textbox.setSelectionStart(newCaret);
  textbox.setSelectionEnd(newCaret);
  textbox.canvas?.requestRenderAll();
  return true;
}

function indentLine(line: string, direction: 1 | -1): string {
  if (direction > 0) return `${INDENT_UNIT}${line}`;
  if (line.startsWith(INDENT_UNIT)) return line.slice(INDENT_UNIT.length);
  if (line.startsWith('\t')) return line.slice(1);
  if (line.startsWith(' ')) return line.slice(1);
  return line;
}

/** Aumenta o reduce la sangría (margen izquierdo) de las líneas seleccionadas. */
export function indentTextLines(
  textbox: Textbox,
  direction: 1 | -1,
  storedSelection: { start: number; end: number } | null = null,
): { start: number; end: number } {
  const full = textbox.text ?? '';
  const range = resolveTargetRange(textbox, storedSelection);
  const lines = linesInRange(full, range.start, range.end);
  const nextParts = lines.map((line) => indentLine(line.content, direction));
  const nextSegment = nextParts.join('\n');
  const nextText = full.slice(0, range.start) + nextSegment + full.slice(range.end);
  const nextStyles = remapStylesOutsideRange(
    textbox,
    full,
    range,
    nextParts.length,
    lines.length,
  );

  textbox.set({
    text: nextText,
    styles: nextStyles,
    dirty: true,
  });
  textbox.initDimensions();
  textbox.setCoords();

  const newEnd = range.start + nextSegment.length;
  if (textbox.isEditing) {
    textbox.setSelectionStart(range.start);
    textbox.setSelectionEnd(newEnd);
  }
  textbox.canvas?.requestRenderAll();
  return { start: range.start, end: newEnd };
}
