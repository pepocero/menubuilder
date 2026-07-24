/**
 * Propiedades de texto Fabric que deben sobrevivir al ciclo
 * Textbox → capa JSON → Textbox (equivalente a canvas.toJSON([...])).
 */
export const CUSTOM_TEXT_PROPS = [
  'lineHeight',
  'charSpacing',
  'padding',
  'splitByGrapheme',
  'textAlign',
  'fontWeight',
  'fontStyle',
  'fontFamily',
  'fontSize',
  'styles',
] as const;

export type CustomTextProp = (typeof CUSTOM_TEXT_PROPS)[number];

/** lineHeight por defecto de Fabric Textbox. */
export const DEFAULT_TEXT_LINE_HEIGHT = 1.16;
