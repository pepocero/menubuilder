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
  opacity?: number;
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

export type CanvasLayer = TextLayer | ShapeLayer | ImageLayer;

/** Una página A4 del menú */
export interface MenuPage {
  id: string;
  background: CanvasBackground;
  layers: CanvasLayer[];
}

/**
 * Documento del menú.
 * Formato nuevo: `pages[]`.
 * Formato legado (1 página): `background` + `layers` — se normaliza al cargar.
 */
export interface CanvasData {
  width: number;
  height: number;
  pages: MenuPage[];
  /** @deprecated compat */
  background?: CanvasBackground;
  /** @deprecated compat */
  layers?: CanvasLayer[];
}

export const A4_WIDTH = 595;
export const A4_HEIGHT = 842;

export function createBlankPage(bg = '#FAF6F0'): MenuPage {
  return {
    id: `page_${crypto.randomUUID().slice(0, 8)}`,
    background: { type: 'color', value: bg },
    layers: [],
  };
}

export const DEFAULT_CANVAS: CanvasData = {
  width: A4_WIDTH,
  height: A4_HEIGHT,
  pages: [
    {
      id: 'page_1',
      background: { type: 'color', value: '#FAF6F0' },
      layers: [],
    },
  ],
};

export function createBlankCanvas(): CanvasData {
  return {
    width: A4_WIDTH,
    height: A4_HEIGHT,
    pages: [createBlankPage()],
  };
}

/** Convierte formato legado o incompleto al modelo con pages[] */
export function normalizeCanvasData(raw: unknown): CanvasData {
  const fallback = createBlankCanvas();
  if (!raw || typeof raw !== 'object') return fallback;

  const d = raw as Record<string, unknown>;
  const width = typeof d.width === 'number' ? d.width : A4_WIDTH;
  const height = typeof d.height === 'number' ? d.height : A4_HEIGHT;

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
      };
    });
    return { width, height, pages };
  }

  // Legado: una sola página con background + layers
  if (d.background && Array.isArray(d.layers)) {
    return {
      width,
      height,
      pages: [
        {
          id: 'page_1',
          background: d.background as CanvasBackground,
          layers: d.layers as CanvasLayer[],
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

/** Serializa para guardar siempre en formato pages[] */
export function serializeCanvasData(data: CanvasData): CanvasData {
  const normalized = normalizeCanvasData(data);
  return {
    width: A4_WIDTH,
    height: A4_HEIGHT,
    pages: normalized.pages,
  };
}
