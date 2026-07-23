/** Subconjunto del modelo interno del editor — solo para conversión a MenuDocument. */
export interface ConverterBackground {
  type: 'color' | 'image';
  value: string;
}

export interface ConverterTextStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
  fontWeight?: string;
  fontStyle?: string;
  opacity?: number;
  border?: {
    style: 'none' | 'solid' | 'dashed' | 'dotted';
    color: string;
    width: number;
    radius: number;
    margin?: number;
    /** @deprecated Usar margin. */
    padding?: number;
  };
}

export interface ConverterShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface ConverterLayerBase {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex: number;
  visible?: boolean;
  opacity?: number;
}

/** Estilos por carácter (formato Fabric Textbox.styles: línea → índice → props). */
export type ConverterCharStyles = Record<
  string,
  Record<string, Record<string, unknown>>
>;

export interface ConverterTextLayer extends ConverterLayerBase {
  type: 'text';
  content: string;
  style: ConverterTextStyle;
  charStyles?: ConverterCharStyles;
}

export interface ConverterShapeLayer extends ConverterLayerBase {
  type: 'shape';
  shape: 'rect' | 'line' | 'circle';
  style: ConverterShapeStyle;
}

export interface ConverterImageLayer extends ConverterLayerBase {
  type: 'image';
  src: string;
}

export type ConverterLayer = ConverterTextLayer | ConverterShapeLayer | ConverterImageLayer;

export interface ConverterPage {
  id: string;
  background: ConverterBackground;
  layers: ConverterLayer[];
  width?: number;
  height?: number;
}

export interface ConverterCanvasData {
  width: number;
  height: number;
  pages: ConverterPage[];
  background?: ConverterBackground;
  layers?: ConverterLayer[];
}

export function normalizeConverterCanvasData(raw: unknown): ConverterCanvasData | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const width = typeof d.width === 'number' ? d.width : 595;
  const height = typeof d.height === 'number' ? d.height : 842;

  if (Array.isArray(d.pages) && d.pages.length > 0) {
    const pages: ConverterPage[] = [];
    for (let i = 0; i < d.pages.length; i++) {
      const p = d.pages[i];
      if (!p || typeof p !== 'object') return null;
      const page = p as Record<string, unknown>;
      const background =
        page.background && typeof page.background === 'object'
          ? (page.background as ConverterBackground)
          : { type: 'color' as const, value: '#FAF6F0' };
      pages.push({
        id: typeof page.id === 'string' ? page.id : `page_${i + 1}`,
        background,
        layers: Array.isArray(page.layers) ? (page.layers as ConverterLayer[]) : [],
        width:
          typeof page.width === 'number' && page.width > 0 ? Math.round(page.width) : width,
        height:
          typeof page.height === 'number' && page.height > 0
            ? Math.round(page.height)
            : height,
      });
    }
    return { width, height, pages };
  }

  if (d.background && typeof d.background === 'object' && Array.isArray(d.layers)) {
    return {
      width,
      height,
      pages: [
        {
          id: 'page_1',
          background: d.background as ConverterBackground,
          layers: d.layers as ConverterLayer[],
        },
      ],
    };
  }

  return null;
}
