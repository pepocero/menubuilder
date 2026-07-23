import type { TextLayer } from '@/types/canvas';
import { ensureEditorFontLoaded } from '@/lib/google-fonts';
import type { FabricCharStyles } from '@/lib/text-char-styles';

const FABRIC_LINE_HEIGHT = 1.16;

function cssFont(
  fontStyle: string | undefined,
  fontWeight: string | number | undefined,
  fontSize: number,
  fontFamily: string,
): string {
  const style =
    fontStyle === 'italic' || fontStyle === 'oblique' ? fontStyle : 'normal';
  const weight =
    fontWeight === 'bold' || fontWeight === '700' || Number(fontWeight) >= 600
      ? '700'
      : fontWeight === 'normal' || fontWeight === '400' || Number(fontWeight) === 400
        ? '400'
        : String(fontWeight ?? '400');
  const family = fontFamily.includes(' ') ? `"${fontFamily}"` : fontFamily || 'Arial';
  return `${style} ${weight} ${fontSize}px ${family}`;
}

async function waitForFonts(families: string[], fontSize: number): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  const unique = [...new Set(families.filter(Boolean))];
  for (const family of unique) {
    ensureEditorFontLoaded(family);
  }

  await Promise.all(
    unique.map(async (family) => {
      const quoted = family.includes(' ') ? `"${family}"` : family;
      try {
        await Promise.all([
          document.fonts.load(`400 ${fontSize}px ${quoted}`),
          document.fonts.load(`700 ${fontSize}px ${quoted}`),
          document.fonts.load(`italic 400 ${fontSize}px ${quoted}`),
          document.fonts.load(`italic 700 ${fontSize}px ${quoted}`),
        ]);
      } catch {
        /* fuente opcional */
      }
    }),
  );

  try {
    await document.fonts.ready;
  } catch {
    /* ignore */
  }

  // iOS a veces marca ready antes de aplicar la cara; breve espera + recheck.
  const pending = unique.some((family) => {
    const quoted = family.includes(' ') ? `"${family}"` : family;
    try {
      return !document.fonts.check(`400 ${fontSize}px ${quoted}`);
    } catch {
      return false;
    }
  });
  if (pending) {
    await new Promise((r) => setTimeout(r, 120));
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }
}

function collectFontFamilies(layer: TextLayer): string[] {
  const families = [layer.style.fontFamily || 'Arial'];
  if (!layer.charStyles) return families;
  for (const line of Object.values(layer.charStyles)) {
    for (const style of Object.values(line)) {
      if (typeof style.fontFamily === 'string') families.push(style.fontFamily);
    }
  }
  return families;
}

function charStyleAt(
  styles: FabricCharStyles | undefined,
  lineIndex: number,
  charIndex: number,
): Record<string, unknown> | undefined {
  if (!styles) return undefined;
  const line = styles[String(lineIndex)] ?? styles[lineIndex as unknown as string];
  if (!line) return undefined;
  return line[String(charIndex)] ?? line[charIndex as unknown as string];
}

function alignX(
  ctx: CanvasRenderingContext2D,
  text: string,
  boxWidth: number,
  align: TextLayer['style']['align'],
): number {
  if (align === 'center') {
    return (boxWidth - ctx.measureText(text).width) / 2;
  }
  if (align === 'right') {
    return boxWidth - ctx.measureText(text).width;
  }
  return 0;
}

function drawPlainLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  y: number,
  boxWidth: number,
  align: TextLayer['style']['align'],
  fill: string,
  font: string,
): void {
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const x = alignX(ctx, line, boxWidth, align);
  ctx.fillText(line, x, y);
}

function drawStyledLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  lineIndex: number,
  y: number,
  boxWidth: number,
  align: TextLayer['style']['align'],
  layer: TextLayer,
  styles: FabricCharStyles,
): void {
  type Run = { text: string; font: string; fill: string; fontSize: number };
  const runs: Run[] = [];
  let buffer = '';
  let runFont = '';
  let runFill = '';
  let runSize = layer.style.fontSize;

  const flush = () => {
    if (!buffer) return;
    runs.push({ text: buffer, font: runFont, fill: runFill, fontSize: runSize });
    buffer = '';
  };

  for (let i = 0; i < line.length; i++) {
    const cs = charStyleAt(styles, lineIndex, i);
    const fontSize =
      typeof cs?.fontSize === 'number' && cs.fontSize > 0
        ? cs.fontSize
        : layer.style.fontSize;
    const fontFamily =
      typeof cs?.fontFamily === 'string' ? cs.fontFamily : layer.style.fontFamily;
    const fontWeight =
      cs?.fontWeight !== undefined ? String(cs.fontWeight) : layer.style.fontWeight;
    const fontStyle =
      typeof cs?.fontStyle === 'string' ? cs.fontStyle : layer.style.fontStyle;
    const fill =
      typeof cs?.fill === 'string' ? cs.fill : layer.style.color;
    const font = cssFont(fontStyle, fontWeight, fontSize, fontFamily || 'Arial');
    if (buffer && (font !== runFont || fill !== runFill)) flush();
    if (!buffer) {
      runFont = font;
      runFill = fill;
      runSize = fontSize;
    }
    buffer += line[i];
  }
  flush();

  let totalWidth = 0;
  for (const run of runs) {
    ctx.font = run.font;
    totalWidth += ctx.measureText(run.text).width;
  }

  let x = 0;
  if (align === 'center') x = (boxWidth - totalWidth) / 2;
  else if (align === 'right') x = boxWidth - totalWidth;

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  for (const run of runs) {
    ctx.font = run.font;
    ctx.fillStyle = run.fill;
    ctx.fillText(run.text, x, y);
    x += ctx.measureText(run.text).width;
  }
}

/**
 * Pinta una capa de texto como en Fabric (canvas), para que espacios y métricas
 * coincidan entre editor y carta pública.
 */
export async function paintPublicTextLayer(
  canvas: HTMLCanvasElement,
  layer: TextLayer,
  scale: number,
): Promise<void> {
  const fontSize = Math.max(layer.style.fontSize || 16, 1);
  await waitForFonts(collectFontFamilies(layer), fontSize);

  const cssW = Math.max(layer.width * scale, 1);
  const cssH = Math.max(layer.height * scale, 1);
  const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 3);

  canvas.width = Math.max(1, Math.ceil(cssW * dpr));
  canvas.height = Math.max(1, Math.ceil(cssH * dpr));

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  ctx.clearRect(0, 0, layer.width, layer.height);
  ctx.imageSmoothingEnabled = true;
  // Métricas más estables entre escritorio y móvil (espacios / precios).
  const ctxExt = ctx as CanvasRenderingContext2D & {
    fontKerning?: string;
    letterSpacing?: string;
  };
  if (typeof ctxExt.fontKerning === 'string' || 'fontKerning' in ctx) {
    ctxExt.fontKerning = 'none';
  }
  if ('letterSpacing' in ctx) {
    ctxExt.letterSpacing = '0px';
  }

  const baseFont = cssFont(
    layer.style.fontStyle,
    layer.style.fontWeight,
    fontSize,
    layer.style.fontFamily || 'Arial',
  );
  const lineHeightPx = fontSize * FABRIC_LINE_HEIGHT;
  const lines = layer.content.split(/\r?\n/);
  const styles = layer.charStyles;
  const hasStyles = !!styles && Object.keys(styles).length > 0;

  let y = 0;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (hasStyles && styles) {
      drawStyledLine(
        ctx,
        line,
        lineIndex,
        y,
        layer.width,
        layer.style.align,
        layer,
        styles,
      );
    } else {
      drawPlainLine(
        ctx,
        line,
        y,
        layer.width,
        layer.style.align,
        layer.style.color,
        baseFont,
      );
    }
    y += lineHeightPx;
  }
}
