import type { Textbox } from 'fabric';

export type TextBorderLineStyle = 'none' | 'solid' | 'dashed' | 'dotted';

export interface TextBorder {
  style: TextBorderLineStyle;
  color: string;
  width: number;
  radius: number;
  /** Espacio entre la línea de borde y el inicio del texto. */
  margin: number;
}

type TextboxWithBorder = Textbox & {
  data?: Record<string, unknown> & { border?: TextBorder | null };
  __menuBorderRenderPatched?: boolean;
  _render: (ctx: CanvasRenderingContext2D) => void;
};

export const DEFAULT_TEXT_BORDER: TextBorder = {
  style: 'none',
  color: '#333333',
  width: 1,
  radius: 0,
  margin: 0,
};

function readBorderMargin(b: Record<string, unknown>): number {
  const raw =
    typeof b.margin === 'number' && Number.isFinite(b.margin)
      ? b.margin
      : typeof b.padding === 'number' && Number.isFinite(b.padding)
        ? b.padding // legado
        : 0;
  return Math.max(0, Math.min(80, raw));
}

export function normalizeTextBorder(raw: unknown): TextBorder | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const b = raw as Record<string, unknown>;
  const style =
    b.style === 'solid' || b.style === 'dashed' || b.style === 'dotted' || b.style === 'none'
      ? b.style
      : 'none';
  const color = typeof b.color === 'string' && b.color ? b.color : '#333333';
  const width =
    typeof b.width === 'number' && Number.isFinite(b.width)
      ? Math.max(0, Math.min(40, b.width))
      : 1;
  const radius =
    typeof b.radius === 'number' && Number.isFinite(b.radius)
      ? Math.max(0, Math.min(200, b.radius))
      : 0;
  const margin = readBorderMargin(b);

  if (style === 'none' || width <= 0) {
    return { style: 'none', color, width: 0, radius, margin };
  }
  return { style, color, width, radius, margin };
}

export function textBorderIsVisible(border: TextBorder | undefined | null): boolean {
  return !!border && border.style !== 'none' && border.width > 0;
}

export function borderDashArray(
  style: TextBorderLineStyle,
  width: number,
): number[] | undefined {
  if (style === 'dashed') return [Math.max(width * 3, 6), Math.max(width * 2, 4)];
  if (style === 'dotted') return [Math.max(width, 2), Math.max(width * 1.5, 3)];
  return undefined;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
  ctx.beginPath();
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTextboxBorder(text: Textbox, ctx: CanvasRenderingContext2D): void {
  const border = normalizeTextBorder(
    (text as TextboxWithBorder).data?.border,
  );
  if (!textBorderIsVisible(border) || !border) return;

  const contentW = text.width ?? 0;
  const contentH = text.height ?? 0;
  if (contentW <= 0 || contentH <= 0) return;

  // El margen aleja la línea de borde del bloque de texto (hacia fuera).
  const gap = Math.max(border.margin ?? 0, 0);
  const w = contentW + 2 * gap;
  const h = contentH + 2 * gap;
  const x = -w / 2;
  const y = -h / 2;

  ctx.save();
  ctx.strokeStyle = border.color;
  ctx.lineWidth = border.width;
  ctx.lineJoin = 'round';
  const dash = borderDashArray(border.style, border.width);
  if (dash) ctx.setLineDash(dash);
  else ctx.setLineDash([]);
  // Inset medio trazo para que el grosor no se recorte en el borde del objeto.
  const inset = border.width / 2;
  roundRectPath(
    ctx,
    x + inset,
    y + inset,
    Math.max(w - border.width, 0),
    Math.max(h - border.width, 0),
    Math.max(border.radius - inset, 0),
  );
  ctx.stroke();
  ctx.restore();
}

/** Aplica borde a un Textbox y parchea el render una sola vez. */
export function syncTextboxBorder(
  text: Textbox,
  border: TextBorder | undefined | null,
): void {
  const tb = text as TextboxWithBorder;
  const data = { ...(tb.data ?? {}) };
  const normalized = normalizeTextBorder(border ?? undefined);
  if (!normalized || !textBorderIsVisible(normalized)) {
    data.border = normalized
      ? { ...normalized, style: 'none' as const, width: 0 }
      : null;
    // Fabric `padding` solo afecta la caja de controles, no el texto.
    text.set({ padding: 0 });
  } else {
    data.border = normalized;
    // Controles = área del borde + margen; objectCaching off para no recortar el trazo.
    text.set({
      padding: normalized.margin + normalized.width / 2,
      objectCaching: false,
    });
  }
  tb.data = data;

  if (!tb.__menuBorderRenderPatched) {
    tb.__menuBorderRenderPatched = true;
    const prev = tb._render.bind(tb);
    tb._render = function patchedRender(ctx: CanvasRenderingContext2D) {
      prev(ctx);
      drawTextboxBorder(this as Textbox, ctx);
    };
  }

  text.set('dirty', true);
  text.initDimensions?.();
  text.setCoords();
  text.canvas?.requestRenderAll();
}

export function readTextboxBorder(text: Textbox): TextBorder {
  return (
    normalizeTextBorder((text as TextboxWithBorder).data?.border) ?? {
      ...DEFAULT_TEXT_BORDER,
    }
  );
}

/** CSS para vista pública / HTML (margen → padding CSS = espacio dentro del borde). */
export function textBorderToCss(
  border: unknown,
  scale = 1,
): {
  border?: string;
  borderRadius?: number | string;
  padding?: number | string;
  boxSizing?: 'border-box';
} {
  const b = normalizeTextBorder(border ?? undefined);
  if (!textBorderIsVisible(b) || !b) return {};
  const w = Math.max(b.width * scale, 0.5);
  const style =
    b.style === 'dashed' ? 'dashed' : b.style === 'dotted' ? 'dotted' : 'solid';
  const gap = Math.max((b.margin ?? 0) * scale, 0);
  return {
    boxSizing: 'border-box',
    border: `${w}px ${style} ${b.color}`,
    borderRadius: Math.max(b.radius * scale, 0),
    ...(gap > 0 ? { padding: gap } : {}),
  };
}
