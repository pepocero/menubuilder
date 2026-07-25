export interface CanvasBackground {
  type: 'color' | 'image';
  value: string;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
  fontWeight?: string;
  fontStyle?: string;
  opacity?: number;
  /** Interlineado Fabric (por defecto 1.16). */
  lineHeight?: number;
  /** Espaciado entre caracteres Fabric (milésimas de em). */
  charSpacing?: number;
  /** Borde decorativo de la caja (no del trazo de glifos). */
  border?: {
    style: 'none' | 'solid' | 'dashed' | 'dotted';
    color: string;
    width: number;
    radius: number;
    /** Espacio entre la línea de borde y el inicio del texto. */
    margin?: number;
  };
}

export interface ShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface LayerBase {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex: number;
  visible?: boolean;
  locked?: boolean;
  /** Nombre personalizado para identificar la capa en el panel */
  name?: string;
  opacity?: number;
}

export interface TextLayer extends LayerBase {
  type: 'text';
  content: string;
  style: TextStyle;
  /**
   * Estilos por carácter (formato Fabric Textbox.styles).
   * Permite negrita/cursiva/etc. en una porción del texto.
   */
  charStyles?: Record<string, Record<string, Record<string, unknown>>>;
}

export interface ShapeLayer extends LayerBase {
  type: 'shape';
  shape: 'rect' | 'line' | 'circle';
  style: ShapeStyle;
}

export interface ImageLayer extends LayerBase {
  type: 'image';
  src: string;
  assetId?: string;
}

/** Separador de la columna central de una línea de carta. */
export type MenuLineLeader = 'dots' | 'dashes' | 'spaces' | 'custom';

export type MenuLineColumnKey = 'left' | 'center' | 'right';

/** Estilo de una celda (independiente del resto). */
export interface MenuLineColumnStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
  fontWeight?: string;
  fontStyle?: string;
}

/** Celda de una fila (contenido + formato). */
export interface MenuLineCell {
  content: string;
  style: MenuLineColumnStyle;
}

/** Una fila: plato | separador | precio. */
export interface MenuLineRow {
  left: MenuLineCell;
  center: MenuLineCell;
  right: MenuLineCell;
  /** Si falta, usa el leader del bloque. */
  leader?: MenuLineLeader;
}

/** Proporciones (compat / snapshot). El layout real usa leftWidth + precio al contenido. */
export interface MenuLineColumnRatios {
  left: number;
  center: number;
  right: number;
}

/**
 * @deprecated Formato de una sola fila. Se normaliza a `rows` + `columnRatios`.
 */
export interface MenuLineColumn {
  content: string;
  style: MenuLineColumnStyle;
  widthRatio: number;
}

/**
 * Bloque de carta: N filas × 3 columnas.
 * - Ancho total = contenedor (asas del grupo).
 * - Columna izquierda (plato): ancho fijo en px de diseño (`leftWidth`).
 * - Columna derecha (precio): al contenido.
 * - Columna central: rellena el resto.
 */
export interface MenuLineLayer extends LayerBase {
  type: 'menuLine';
  /** Separador por defecto (filas sin override). */
  leader: MenuLineLeader;
  /**
   * Ancho de la columna plato en px de diseño.
   * Si falta, se deriva de `columnRatios.left * width`.
   */
  leftWidth?: number;
  /** Snapshot de proporciones (compat / depuración). */
  columnRatios: MenuLineColumnRatios;
  rows: MenuLineRow[];
  /** Espacio vertical entre filas (px de diseño). */
  rowGap?: number;
  /**
   * @deprecated compat 1 fila.
   * Si existe y `rows` está vacío, se convierte al cargar.
   */
  columns?: {
    left: MenuLineColumn;
    center: MenuLineColumn;
    right: MenuLineColumn;
  };
}

export type CanvasLayer = TextLayer | ShapeLayer | ImageLayer | MenuLineLayer;

/** Una página del menú (tamaño independiente; por defecto A4). */
export interface MenuPage {
  id: string;
  background: CanvasBackground;
  layers: CanvasLayer[];
  /** Ancho en puntos (~72 dpi). Si falta, A4_WIDTH. */
  width?: number;
  /** Alto en puntos (~72 dpi). Si falta, A4_HEIGHT. */
  height?: number;
}

/** Dirección del scroll entre páginas en la carta pública (QR). El editor no cambia. */
export type PageScrollDirection = 'vertical' | 'horizontal';

/**
 * Separación entre páginas en la vista pública (px).
 * Valores fijos para no romper estética ni scroll/snap.
 */
export type PageGap = 0 | 8 | 16 | 24 | 32 | 48;

export const PAGE_GAP_OPTIONS: ReadonlyArray<{ value: PageGap; label: string }> = [
  { value: 0, label: 'Ninguna' },
  { value: 8, label: 'Mínima' },
  { value: 16, label: 'Compacta' },
  { value: 24, label: 'Normal' },
  { value: 32, label: 'Amplia' },
  { value: 48, label: 'Muy amplia' },
];

const PAGE_GAP_VALUES = new Set<number>(PAGE_GAP_OPTIONS.map((o) => o.value));

/**
 * Documento del menú.
 * Formato nuevo: `pages[]`.
 * Formato legado (1 página): `background` + `layers` — se normaliza al cargar.
 */
export interface CanvasData {
  width: number;
  height: number;
  pages: MenuPage[];
  /**
   * Scroll entre páginas solo en la vista pública.
   * Por defecto: vertical. El editor siempre apila en vertical.
   */
  pageScroll?: PageScrollDirection;
  /**
   * Separación entre páginas solo en la vista pública.
   * Por defecto: 0 (sin hueco). El editor no la usa al apilar.
   */
  pageGap?: PageGap;
  /** @deprecated compat */
  background?: CanvasBackground;
  /** @deprecated compat */
  layers?: CanvasLayer[];
}

export const A4_WIDTH = 595;
export const A4_HEIGHT = 842;

function normalizePageSize(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback;
}

export function normalizePageScroll(value: unknown): PageScrollDirection {
  return value === 'horizontal' ? 'horizontal' : 'vertical';
}

export function normalizePageGap(value: unknown): PageGap {
  if (typeof value === 'number' && PAGE_GAP_VALUES.has(value)) {
    return value as PageGap;
  }
  return 0;
}

export function createBlankPage(
  bg = '#FAF6F0',
  size?: { width?: number; height?: number },
): MenuPage {
  return {
    id: `page_${crypto.randomUUID().slice(0, 8)}`,
    background: { type: 'color', value: bg },
    layers: [],
    width: normalizePageSize(size?.width, A4_WIDTH),
    height: normalizePageSize(size?.height, A4_HEIGHT),
  };
}

export const DEFAULT_CANVAS: CanvasData = {
  width: A4_WIDTH,
  height: A4_HEIGHT,
  pageScroll: 'vertical',
  pageGap: 0,
  pages: [
    {
      id: 'page_1',
      background: { type: 'color', value: '#FAF6F0' },
      layers: [],
      width: A4_WIDTH,
      height: A4_HEIGHT,
    },
  ],
};

export function createBlankCanvas(): CanvasData {
  return {
    width: A4_WIDTH,
    height: A4_HEIGHT,
    pageScroll: 'vertical',
    pageGap: 0,
    pages: [createBlankPage()],
  };
}

/** Convierte formato legado o incompleto al modelo con pages[] */
export function normalizeCanvasData(raw: unknown): CanvasData {
  const fallback = createBlankCanvas();
  if (!raw || typeof raw !== 'object') return fallback;

  const d = raw as Record<string, unknown>;
  const width = normalizePageSize(d.width, A4_WIDTH);
  const height = normalizePageSize(d.height, A4_HEIGHT);
  const pageScroll = normalizePageScroll(d.pageScroll);
  const pageGap = normalizePageGap(d.pageGap);

  if (Array.isArray(d.pages) && d.pages.length > 0) {
    const pages: MenuPage[] = d.pages.map((p, index) => {
      const page = (p ?? {}) as Record<string, unknown>;
      const background =
        page.background && typeof page.background === 'object'
          ? (page.background as CanvasBackground)
          : { type: 'color' as const, value: '#FAF6F0' };
      return {
        id: typeof page.id === 'string' ? page.id : `page_${index + 1}`,
        background,
        layers: Array.isArray(page.layers) ? (page.layers as CanvasLayer[]) : [],
        width: normalizePageSize(page.width, width),
        height: normalizePageSize(page.height, height),
      };
    });
    return { width, height, pageScroll, pageGap, pages };
  }

  // Legado: una sola página con background + layers
  if (d.background && Array.isArray(d.layers)) {
    return {
      width,
      height,
      pageScroll,
      pageGap,
      pages: [
        {
          id: 'page_1',
          background: d.background as CanvasBackground,
          layers: d.layers as CanvasLayer[],
          width,
          height,
        },
      ],
    };
  }

  return fallback;
}

export function validateCanvasData(data: unknown): data is CanvasData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (typeof d.width !== 'number' || typeof d.height !== 'number') return false;

  if (Array.isArray(d.pages) && d.pages.length > 0) {
    return d.pages.every((p) => {
      if (!p || typeof p !== 'object') return false;
      const page = p as Record<string, unknown>;
      return (
        page.background !== null &&
        typeof page.background === 'object' &&
        Array.isArray(page.layers)
      );
    });
  }

  // Legado
  return (
    d.background !== null &&
    typeof d.background === 'object' &&
    Array.isArray(d.layers)
  );
}

/** Serializa para guardar siempre en formato pages[] con tamaño por página. */
export function serializeCanvasData(data: CanvasData): CanvasData {
  const normalized = normalizeCanvasData(data);
  return {
    width: normalized.width || A4_WIDTH,
    height: normalized.height || A4_HEIGHT,
    pageScroll: normalizePageScroll(normalized.pageScroll ?? data.pageScroll),
    pageGap: normalizePageGap(normalized.pageGap ?? data.pageGap),
    pages: normalized.pages.map((page) => ({
      ...page,
      width: normalizePageSize(page.width, normalized.width || A4_WIDTH),
      height: normalizePageSize(page.height, normalized.height || A4_HEIGHT),
    })),
  };
}
