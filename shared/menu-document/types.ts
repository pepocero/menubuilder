/** Formato exportable versionado — independiente del editor y del renderer. */
export const MENU_DOCUMENT_VERSION = 1 as const;

export type MenuDocumentVersion = typeof MENU_DOCUMENT_VERSION;

/** Porcentaje 0–100 relativo al lienzo de la página. */
export type Percent = number;

export interface MenuDocumentCanvas {
  width: number;
  height: number;
  background: string;
  backgroundImage?: string;
}

export interface MenuDocumentBox {
  x: Percent;
  y: Percent;
  width: Percent;
  height: Percent;
  rotation?: number;
  opacity?: number;
  zIndex: number;
}

export interface MenuDocumentTextStyle {
  fontFamily: string;
  /** Tamaño como % del ancho del lienzo (responsive). */
  fontSize: Percent;
  fontWeight?: string;
  lineHeight?: number;
  letterSpacing?: Percent;
  textAlign: 'left' | 'center' | 'right';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  color: string;
}

export interface MenuDocumentTextElement extends MenuDocumentBox {
  id: string;
  type: 'text';
  text: string;
  style: MenuDocumentTextStyle;
  /** Sugerencia semántica para el renderer (h1, h2, p…). */
  semantic?: 'heading' | 'subheading' | 'body' | 'caption';
}

export interface MenuDocumentImageElement extends MenuDocumentBox {
  id: string;
  type: 'image';
  src: string;
  alt?: string;
  objectFit?: 'cover' | 'contain';
}

export interface MenuDocumentShapeElement extends MenuDocumentBox {
  id: string;
  type: 'shape';
  shape: 'rect' | 'circle';
  fill?: string;
  stroke?: string;
  /** Grosor como % del ancho del lienzo. */
  strokeWidth?: Percent;
}

export interface MenuDocumentDividerElement extends MenuDocumentBox {
  id: string;
  type: 'divider';
  color: string;
  /** Grosor como % del ancho del lienzo. */
  thickness: Percent;
}

export type MenuDocumentElement =
  | MenuDocumentTextElement
  | MenuDocumentImageElement
  | MenuDocumentShapeElement
  | MenuDocumentDividerElement;

export interface MenuDocumentPage {
  id: string;
  canvas: MenuDocumentCanvas;
  elements: MenuDocumentElement[];
}

export interface MenuDocumentMeta {
  title?: string;
  exportedAt?: string;
  sourceMenuId?: string;
}

/**
 * Documento exportable del menú.
 * Fuente de verdad para HTML, PDF futuro, traducciones, etc.
 */
export interface MenuDocument {
  version: MenuDocumentVersion;
  meta?: MenuDocumentMeta;
  pages: MenuDocumentPage[];
}
