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

/**
 * Aplica estilo a la selección en edición, o al cuadro completo si no hay selección.
 * No borra otros estilos de carácter ajenos a las props indicadas.
 */
export function applyTextStyleProps(
  text: Textbox,
  props: Record<string, unknown>,
): void {
  if (textboxHasSelection(text)) {
    const start = text.selectionStart ?? 0;
    const end = text.selectionEnd ?? 0;
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
): CSSProperties {
  const fill = charStyle?.fill;
  const fontSize = charStyle?.fontSize;
  return {
    color: typeof fill === 'string' ? fill : base.color,
    fontFamily:
      typeof charStyle?.fontFamily === 'string' ? charStyle.fontFamily : base.fontFamily,
    fontSize:
      typeof fontSize === 'number'
        ? Math.max(fontSize * fontSizeScale, 4)
        : base.fontSize !== undefined
          ? Math.max(base.fontSize * fontSizeScale, 4)
          : undefined,
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
      const css = styleRecordToCss(base, charStyle, fontSizeScale);
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
