import type { Textbox } from 'fabric';
import type { CSSProperties, ReactNode } from 'react';
import { createElement } from 'react';

/** Estilos por carácter de Fabric: styles[línea][índiceEnLínea] */
export type FabricCharStyles = Record<string, Record<string, Record<string, unknown>>>;

export function cloneFabricCharStyles(styles: unknown): FabricCharStyles | undefined {
  if (!styles || typeof styles !== 'object') return undefined;
  const raw = styles as FabricCharStyles;
  if (Object.keys(raw).length === 0) return undefined;
  return JSON.parse(JSON.stringify(raw)) as FabricCharStyles;
}

export function textboxHasSelection(text: Textbox): boolean {
  if (!text.isEditing) return false;
  const start = text.selectionStart ?? 0;
  const end = text.selectionEnd ?? 0;
  return end > start;
}

export function textboxIsEditing(text: Textbox): boolean {
  return !!text.isEditing;
}

function isBoldValue(value: unknown): boolean {
  return value === 'bold' || value === '700' || Number(value) >= 600;
}

function isItalicValue(value: unknown): boolean {
  return value === 'italic' || value === 'oblique';
}

/** Estado de negrita/cursiva para el panel (selección o estilo del cuadro). */
export function getTextFormatState(text: Textbox): { bold: boolean; italic: boolean } {
  if (textboxHasSelection(text)) {
    const start = text.selectionStart ?? 0;
    const end = text.selectionEnd ?? 0;
    const styles = text.getSelectionStyles(start, end, true);
    if (styles.length === 0) {
      return {
        bold: isBoldValue(text.fontWeight),
        italic: isItalicValue(text.fontStyle),
      };
    }
    const bold = styles.every((s) =>
      isBoldValue(s.fontWeight !== undefined ? s.fontWeight : text.fontWeight),
    );
    const italic = styles.every((s) =>
      isItalicValue(s.fontStyle !== undefined ? s.fontStyle : text.fontStyle),
    );
    return { bold, italic };
  }

  return {
    bold: isBoldValue(text.fontWeight),
    italic: isItalicValue(text.fontStyle),
  };
}

function baseFontSize(text: Textbox): number {
  const base = Number(text.fontSize);
  return Number.isFinite(base) && base > 0 ? base : 16;
}

function styleEntryFontSize(text: Textbox, style: Record<string, unknown> | undefined): number {
  const fromChar = Number(style?.fontSize);
  if (Number.isFinite(fromChar) && fromChar > 0) return fromChar;
  return baseFontSize(text);
}

/** Tamaños de fuente en un rango [start, end) del Textbox. */
export function getFontSizesInRange(
  text: Textbox,
  start: number,
  end: number,
): number[] {
  if (end <= start) return [];
  const styles = text.getSelectionStyles(start, end, true);
  if (styles.length === 0) return [baseFontSize(text)];
  return styles.map((s) => styleEntryFontSize(text, s as Record<string, unknown>));
}

/** Tamaño en la posición del cursor (caret colapsado). */
export function getFontSizeAtCaret(text: Textbox, caretIndex?: number): number {
  const content = text.text ?? '';
  const len = content.length;
  const caret = caretIndex ?? text.selectionStart ?? 0;
  if (len === 0) return baseFontSize(text);

  // Carácter bajo el cursor; si está al final, el anterior.
  const charIndex = caret < len ? caret : Math.max(0, len - 1);
  const sizes = getFontSizesInRange(text, charIndex, charIndex + 1);
  return sizes[0] ?? baseFontSize(text);
}

export interface ActiveFontSizeInfo {
  /** Valor a mostrar; null = varios tamaños (mostrar guion). */
  display: number | null;
  mixed: boolean;
  /** Base para −/+: el mínimo del rango, o el del caret/objeto. */
  stepBase: number;
  /** Hay selección con al menos un carácter. */
  hasSelection: boolean;
}

/**
 * Tamaño activo para el panel:
 * - caret: tamaño en esa posición
 * - selección uniforme: ese tamaño
 * - selección mixta: display null + stepBase = mínimo
 * - sin edición: tamaño del cuadro
 */
export function getActiveFontSizeInfo(
  text: Textbox,
  storedRange?: { start: number; end: number } | null,
): ActiveFontSizeInfo {
  const liveEditing = textboxIsEditing(text);
  const liveStart = text.selectionStart ?? 0;
  const liveEnd = text.selectionEnd ?? 0;

  let start = liveStart;
  let end = liveEnd;
  let editing = liveEditing;

  if (!liveEditing && storedRange) {
    start = storedRange.start;
    end = storedRange.end;
    editing = true;
  } else if (liveEditing) {
    start = liveStart;
    end = liveEnd;
  }

  if (editing && end > start) {
    const sizes = getFontSizesInRange(text, start, end);
    if (sizes.length === 0) {
      const base = baseFontSize(text);
      return { display: base, mixed: false, stepBase: base, hasSelection: true };
    }
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    if (min === max) {
      return { display: min, mixed: false, stepBase: min, hasSelection: true };
    }
    return { display: null, mixed: true, stepBase: min, hasSelection: true };
  }

  if (editing) {
    const atCaret = getFontSizeAtCaret(text, start);
    return {
      display: atCaret,
      mixed: false,
      stepBase: atCaret,
      hasSelection: false,
    };
  }

  const objectSize = baseFontSize(text);
  return {
    display: objectSize,
    mixed: false,
    stepBase: objectSize,
    hasSelection: false,
  };
}

/**
 * Aplica estilo a la selección en edición, o al cuadro completo si no hay selección.
 * `range` permite aplicar a una porción aunque el input del panel haya robado el foco.
 * No borra otros estilos de carácter ajenos a las props indicadas.
 */
export function applyTextStyleProps(
  text: Textbox,
  props: Record<string, unknown>,
  range?: { start: number; end: number } | null,
): void {
  const liveStart = text.selectionStart ?? 0;
  const liveEnd = text.selectionEnd ?? 0;
  const start = range && range.end > range.start ? range.start : liveStart;
  const end = range && range.end > range.start ? range.end : liveEnd;
  const applyToRange =
    end > start && (textboxHasSelection(text) || (!!range && range.end > range.start));

  if (applyToRange) {
    text.setSelectionStyles(props, start, end);
    text.set('dirty', true);
    text.initDimensions();
    text.setCoords();
    text.canvas?.requestRenderAll();
    return;
  }

  text.set(props);

  // Tras OCR/pegado, muchos caracteres traen fontSize propio y el del cuadro no se ve.
  // Sincronizar las props aplicadas en todos los estilos por carácter.
  const styles = text.styles as FabricCharStyles | undefined;
  if (styles && typeof styles === 'object' && Object.keys(props).length > 0) {
    for (const line of Object.values(styles)) {
      if (!line || typeof line !== 'object') continue;
      for (const charStyle of Object.values(line)) {
        if (!charStyle || typeof charStyle !== 'object') continue;
        Object.assign(charStyle, props);
      }
    }
    text.set('styles', styles);
  }

  text.set('dirty', true);
  text.initDimensions();
  text.setCoords();
  text.canvas?.requestRenderAll();
}

function styleRecordToCss(
  base: {
    color?: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    fontStyle?: string;
  },
  charStyle: Record<string, unknown> | undefined,
  fontSizeScale: number,
  fontSizeUnit: 'px' | 'cqw' = 'px',
): CSSProperties {
  const fill = charStyle?.fill;
  const fontSize = charStyle?.fontSize;
  const resolvedSize =
    typeof fontSize === 'number'
      ? Math.max(fontSize * fontSizeScale, fontSizeUnit === 'cqw' ? 0.05 : 4)
      : base.fontSize !== undefined
        ? Math.max(base.fontSize * fontSizeScale, fontSizeUnit === 'cqw' ? 0.05 : 4)
        : undefined;

  return {
    color: typeof fill === 'string' ? fill : base.color,
    fontFamily:
      typeof charStyle?.fontFamily === 'string' ? charStyle.fontFamily : base.fontFamily,
    fontSize:
      resolvedSize === undefined
        ? undefined
        : fontSizeUnit === 'cqw'
          ? `${resolvedSize}cqw`
          : resolvedSize,
    fontWeight:
      charStyle?.fontWeight !== undefined
        ? (charStyle.fontWeight as string | number)
        : base.fontWeight,
    fontStyle:
      typeof charStyle?.fontStyle === 'string' ? charStyle.fontStyle : base.fontStyle,
  };
}

/**
 * Renderiza texto con estilos por carácter de Fabric como nodos React (vista pública).
 * @param fontSizeUnit `cqw` cuando los tamaños ya van en % del ancho del contenedor (MenuDocument).
 */
export function renderTextContentWithCharStyles(
  content: string,
  styles: FabricCharStyles | undefined,
  base: {
    color?: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    fontStyle?: string;
  },
  fontSizeScale = 1,
  fontSizeUnit: 'px' | 'cqw' = 'px',
): ReactNode {
  if (!styles || Object.keys(styles).length === 0) {
    return content;
  }

  const lines = content.split('\n');
  const nodes: ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) {
      nodes.push(createElement('br', { key: `br-${lineIndex}` }));
    }

    const lineStyles = styles[String(lineIndex)] ?? styles[lineIndex as unknown as string];
    if (!lineStyles || Object.keys(lineStyles).length === 0) {
      nodes.push(line);
      return;
    }

    let buffer = '';
    let bufferStyleKey = '';
    let bufferCss: CSSProperties | null = null;
    let part = 0;

    const flush = () => {
      if (!buffer) return;
      if (bufferCss) {
        nodes.push(
          createElement(
            'span',
            { key: `l${lineIndex}-p${part++}`, style: bufferCss },
            buffer,
          ),
        );
      } else {
        nodes.push(buffer);
      }
      buffer = '';
      bufferStyleKey = '';
      bufferCss = null;
    };

    for (let i = 0; i < line.length; i++) {
      const charStyle = lineStyles[String(i)] ?? lineStyles[i as unknown as string];
      const css = styleRecordToCss(base, charStyle, fontSizeScale, fontSizeUnit);
      const key = JSON.stringify(css);
      if (buffer && key !== bufferStyleKey) flush();
      if (!buffer) {
        bufferStyleKey = key;
        bufferCss =
          charStyle && Object.keys(charStyle).length > 0 ? css : null;
      }
      buffer += line[i];
    }
    flush();
  });

  return nodes;
}
