import type { Canvas } from 'fabric';
import type { TextLayer } from '@/types/canvas';
import { A4_HEIGHT, A4_WIDTH } from '@/types/canvas';
import {
  addLayerToCanvas,
  fitImageToA4,
  imageLayerToFabricObject,
} from '@/lib/canvas-serializer';

export interface OcrBBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrLine {
  text: string;
  bbox: OcrBBox;
  confidence: number;
  words?: Array<{
    text: string;
    confidence: number;
    bbox: OcrBBox;
  }>;
}

export interface MenuImageOcrResult {
  lines: OcrLine[];
  imageWidth: number;
  imageHeight: number;
  /** Eje X del divisor de columnas si se detectó (hueco / línea vertical). */
  columnSplitX?: number | null;
}

/** Idiomas OCR disponibles en el modal de importación. */
export const OCR_LANGUAGE_PRESETS = [
  { id: 'cat', label: 'Català', langs: ['cat'] as const, hint: 'Cartes en catalán' },
  { id: 'spa', label: 'Español', langs: ['spa'] as const, hint: 'Cartes en castellano' },
  {
    id: 'cat-spa',
    label: 'Català + Español',
    langs: ['cat', 'spa'] as const,
    hint: 'Mezcla o menús bilingües',
  },
  { id: 'eng', label: 'English', langs: ['eng'] as const, hint: 'Menus in English' },
  {
    id: 'spa-eng',
    label: 'Español + English',
    langs: ['spa', 'eng'] as const,
    hint: 'Turismo / bilingüe',
  },
] as const;

export type OcrLanguagePresetId = (typeof OCR_LANGUAGE_PRESETS)[number]['id'];

export const DEFAULT_OCR_LANGUAGE: OcrLanguagePresetId = 'cat';

export function resolveOcrLanguages(presetId: OcrLanguagePresetId): string[] {
  const preset = OCR_LANGUAGE_PRESETS.find((p) => p.id === presetId);
  return [...(preset?.langs ?? ['cat'])];
}

/** Umbral bajo: en cartas decorativas la confianza suele ser peor que en documentos. */
const MIN_CONFIDENCE = 15;
const MIN_TEXT_LENGTH = 1;

type OcrWordNode = {
  text: string;
  confidence: number;
  bbox: OcrBBox;
};

type OcrLineNode = {
  text: string;
  confidence: number;
  bbox: OcrBBox;
  words?: OcrWordNode[];
};

type OcrPageLike = {
  text?: string | null;
  blocks?: Array<{
    paragraphs?: Array<{
      lines?: OcrLineNode[];
    }>;
  }> | null;
};

function extractOcrLines(page: OcrPageLike): OcrLine[] {
  const lines: OcrLine[] = [];

  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        const text = line.text.replace(/\s+/g, ' ').trim();
        if (text.length < MIN_TEXT_LENGTH) continue;
        if ((line.confidence ?? 0) < MIN_CONFIDENCE) continue;

        const words = (line.words ?? [])
          .map((w) => ({
            text: w.text.replace(/\s+/g, ' ').trim(),
            confidence: w.confidence ?? 0,
            bbox: {
              x0: w.bbox.x0,
              y0: w.bbox.y0,
              x1: w.bbox.x1,
              y1: w.bbox.y1,
            },
          }))
          .filter((w) => w.text.length > 0);

        lines.push({
          text,
          bbox: {
            x0: line.bbox.x0,
            y0: line.bbox.y0,
            x1: line.bbox.x1,
            y1: line.bbox.y1,
          },
          confidence: line.confidence ?? 0,
          words: words.length > 0 ? words : undefined,
        });
      }
    }
  }

  return lines;
}

/** Fallback si hay texto plano pero no llegó la estructura blocks. */
function linesFromPlainText(
  text: string,
  imageWidth: number,
  imageHeight: number,
): OcrLine[] {
  const rawLines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= MIN_TEXT_LENGTH);

  if (rawLines.length === 0) return [];

  const marginX = imageWidth * 0.08;
  const usableHeight = imageHeight * 0.84;
  const startY = imageHeight * 0.08;
  const lineHeight = Math.max(18, usableHeight / Math.max(rawLines.length, 1));

  return rawLines.map((line, index) => {
    const y0 = startY + index * lineHeight;
    const y1 = y0 + lineHeight * 0.75;
    return {
      text: line,
      confidence: 50,
      bbox: {
        x0: marginX,
        y0,
        x1: imageWidth - marginX,
        y1,
      },
    };
  });
}

export function getImageDimensions(file: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

/**
 * Prepara la imagen para OCR: escala razonable y canvas RGB limpio.
 * Evita contraste agresivo: en tipografías “grunge”/decorativas empeora el reconocimiento.
 */
export async function prepareImageForOcr(file: Blob): Promise<{
  blob: Blob;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
}> {
  const dims = await getImageDimensions(file);
  const maxSide = Math.max(dims.width, dims.height);
  const minSide = Math.min(dims.width, dims.height);

  // Cartas escaneadas ~700px necesitan upscale; Tesseract rinde mejor cerca de 1500–2000 px.
  let targetScale = 1;
  if (minSide < 1600) {
    targetScale = 1600 / minSide;
  } else if (maxSide > 3200) {
    targetScale = 3200 / maxSide;
  }

  const width = Math.max(1, Math.round(dims.width * targetScale));
  const height = Math.max(1, Math.round(dims.height * targetScale));

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo preparar la imagen para OCR'));
      el.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('No se pudo preparar la imagen para OCR');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    // Solo gris suave (sin contraste fuerte) para estabilizar color de papel / foto.
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    ctx.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error('No se pudo convertir la imagen para OCR'));
        },
        'image/png',
        1,
      );
    });

    return { blob, width, height, canvas };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Corrige errores típicos de OCR en precios de carta (8,00€ leído como 800€). */
export function normalizeMenuOcrText(text: string): string {
  return text
    .replace(/\b([1-9])00\s*€/g, '$1,00€')
    .replace(/\b([1-9])00\s*eur(?:os?)?\b/gi, '$1,00€')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeOcrLines(lines: OcrLine[]): OcrLine[] {
  return lines
    .map((line) => ({
      ...line,
      text: normalizeMenuOcrText(line.text),
    }))
    .filter((line) => line.text.length >= MIN_TEXT_LENGTH);
}

/**
 * Une trozos de la misma fila que Tesseract partió en varias “líneas”
 * (p. ej. título a ancho de página: "BAR LES" + "PISCINES L'ALEIXAR").
 * No une texto de columnas distintas si se conoce el eje del divisor.
 */
export function mergeFragmentedOcrLines(
  lines: OcrLine[],
  columnSplitX?: number | null,
): OcrLine[] {
  if (lines.length < 2) return lines;

  const sorted = sortReadingOrder(lines);
  const medianH = median(sorted.map(lineHeight)) || 16;
  const merged: OcrLine[] = [];

  for (const line of sorted) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push({
        ...line,
        bbox: { ...line.bbox },
        words: line.words ? line.words.map((w) => ({ ...w, bbox: { ...w.bbox } })) : undefined,
      });
      continue;
    }

    const prevMidY = (prev.bbox.y0 + prev.bbox.y1) / 2;
    const lineMidY = (line.bbox.y0 + line.bbox.y1) / 2;
    const sameRow =
      Math.abs(prevMidY - lineMidY) <= medianH * 0.65 &&
      Math.abs(prev.bbox.y0 - line.bbox.y0) <= medianH * 0.75;

    const gap = line.bbox.x0 - prev.bbox.x1;
    const maxGap = Math.max(medianH * 2.2, 36);

    const crossesColumns =
      columnSplitX != null &&
      ((lineMidX(prev) < columnSplitX) !== (lineMidX(line) < columnSplitX));

    if (sameRow && !crossesColumns && gap >= -12 && gap <= maxGap) {
      const joiner = gap < medianH * 0.15 ? '' : ' ';
      prev.text = `${prev.text}${joiner}${line.text}`.replace(/\s+/g, ' ').trim();
      prev.bbox = unionBBox([prev.bbox, line.bbox]);
      prev.confidence = Math.min(prev.confidence, line.confidence);
      if (prev.words || line.words) {
        prev.words = [...(prev.words ?? []), ...(line.words ?? [])];
      }
      continue;
    }

    merged.push({
      ...line,
      bbox: { ...line.bbox },
      words: line.words ? line.words.map((w) => ({ ...w, bbox: { ...w.bbox } })) : undefined,
    });
  }

  return merged;
}

/**
 * Si Tesseract juntó platos de dos columnas en una sola línea, los separa
 * con las cajas de palabras. No recorta la imagen (eso rompía títulos anchos).
 */
export function splitCrossColumnOcrLines(
  lines: OcrLine[],
  imageWidth: number,
  preferredSplitX?: number | null,
): OcrLine[] {
  const splitX = findColumnSplitX(lines, imageWidth, preferredSplitX);
  if (splitX == null) return lines;

  const gutter = Math.max(10, imageWidth * 0.02);
  const result: OcrLine[] = [];

  for (const line of lines) {
    const crosses = line.bbox.x0 < splitX - gutter && line.bbox.x1 > splitX + gutter;
    const wide = line.bbox.x1 - line.bbox.x0 >= imageWidth * 0.55;

    if (!crosses || !line.words || line.words.length < 2) {
      result.push(line);
      continue;
    }

    const leftWords = line.words.filter((w) => (w.bbox.x0 + w.bbox.x1) / 2 < splitX);
    const rightWords = line.words.filter((w) => (w.bbox.x0 + w.bbox.x1) / 2 >= splitX);

    if (leftWords.length === 0 || rightWords.length === 0) {
      result.push(line);
      continue;
    }

    const leftEdge = Math.max(...leftWords.map((w) => w.bbox.x1));
    const rightEdge = Math.min(...rightWords.map((w) => w.bbox.x0));
    const midGap = rightEdge - leftEdge;

    // Título / línea continua a ancho de página (poco hueco entre palabras)
    if (wide && midGap < gutter * 1.25) {
      result.push(line);
      continue;
    }

    result.push({
      text: leftWords.map((w) => w.text).join(' ').replace(/\s+/g, ' ').trim(),
      bbox: unionBBox(leftWords.map((w) => w.bbox)),
      confidence: median(leftWords.map((w) => w.confidence)) || line.confidence,
      words: leftWords,
    });
    result.push({
      text: rightWords.map((w) => w.text).join(' ').replace(/\s+/g, ' ').trim(),
      bbox: unionBBox(rightWords.map((w) => w.bbox)),
      confidence: median(rightWords.map((w) => w.confidence)) || line.confidence,
      words: rightWords,
    });
  }

  return result.filter((l) => l.text.length >= MIN_TEXT_LENGTH);
}

/** Mapea coordenadas de píxeles de la imagen al lienzo A4 con modo cover. */
export function mapImageRectToA4Cover(
  bbox: OcrBBox,
  imageWidth: number,
  imageHeight: number,
  canvasWidth = A4_WIDTH,
  canvasHeight = A4_HEIGHT,
): { x: number; y: number; width: number; height: number; fontSize: number } {
  const iw = Math.max(imageWidth, 1);
  const ih = Math.max(imageHeight, 1);
  const scale = Math.max(canvasWidth / iw, canvasHeight / ih);
  const scaledW = iw * scale;
  const scaledH = ih * scale;
  const offsetX = (canvasWidth - scaledW) / 2;
  const offsetY = (canvasHeight - scaledH) / 2;

  const boxW = Math.max(16, (bbox.x1 - bbox.x0) * scale);
  const boxH = Math.max(10, (bbox.y1 - bbox.y0) * scale);

  return {
    x: offsetX + bbox.x0 * scale,
    y: offsetY + bbox.y0 * scale,
    width: boxW,
    height: boxH,
    fontSize: Math.max(9, Math.min(48, boxH * 0.82)),
  };
}

export function ocrLineToTextLayer(
  line: OcrLine,
  imageWidth: number,
  imageHeight: number,
  zIndex: number,
): TextLayer {
  const mapped = mapImageRectToA4Cover(line.bbox, imageWidth, imageHeight);
  return {
    id: `layer_${crypto.randomUUID().slice(0, 8)}`,
    type: 'text',
    name: line.text.slice(0, 40),
    content: line.text,
    x: mapped.x,
    y: mapped.y,
    width: mapped.width,
    height: mapped.height,
    rotation: 0,
    zIndex,
    style: {
      fontFamily: 'Arial',
      fontSize: mapped.fontSize,
      color: '#1a1a1a',
      align: 'left',
    },
  };
}

function lineHeight(line: OcrLine): number {
  return Math.max(1, line.bbox.y1 - line.bbox.y0);
}

function lineMidX(line: OcrLine): number {
  return (line.bbox.x0 + line.bbox.x1) / 2;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function unionBBox(boxes: OcrBBox[]): OcrBBox {
  return {
    x0: Math.min(...boxes.map((b) => b.x0)),
    y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    y1: Math.max(...boxes.map((b) => b.y1)),
  };
}

function sortReadingOrder(lines: OcrLine[]): OcrLine[] {
  return [...lines].sort((a, b) => {
    const dy = a.bbox.y0 - b.bbox.y0;
    if (Math.abs(dy) > 8) return dy;
    return a.bbox.x0 - b.bbox.x0;
  });
}

function inferImageWidth(lines: OcrLine[]): number {
  if (lines.length === 0) return A4_WIDTH;
  return Math.max(...lines.map((l) => l.bbox.x1), A4_WIDTH);
}

/**
 * Busca el eje vertical del divisor entre columnas (hueco / línea central).
 * Usa centros de palabras (no el ancho de la línea): si una línea OCR cruza
 * las dos columnas, rellenar bins con el bbox completo ocultaba el hueco.
 */
export function findColumnSplitX(
  lines: OcrLine[],
  imageWidth: number,
  preferredSplitX?: number | null,
): number | null {
  if (lines.length < 6 || imageWidth < 120) return null;

  const bins = 64;
  const occupancy = new Float64Array(bins);

  const addMid = (mid: number, weight = 1) => {
    const b = Math.floor((Math.min(imageWidth - 1, Math.max(0, mid)) / imageWidth) * bins);
    if (b >= 0 && b < bins) occupancy[b] += weight;
  };

  for (const line of lines) {
    if (line.words && line.words.length > 0) {
      for (const w of line.words) {
        addMid((w.bbox.x0 + w.bbox.x1) / 2, 1);
      }
    } else {
      // Solo el centro: no pintar todo el tramo (rompe la detección del gutter).
      addMid(lineMidX(line), 1);
    }
  }

  const lo = Math.floor(bins * 0.28);
  const hi = Math.ceil(bins * 0.72);
  const emptyThreshold = Math.max(0.75, lines.length * 0.02);

  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;

  for (let b = lo; b < hi; b++) {
    if (occupancy[b] <= emptyThreshold) {
      if (curStart < 0) curStart = b;
      curLen += 1;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }

  const minGutterBins = Math.max(2, Math.floor(bins * 0.025));
  let splitFromBins: number | null = null;
  if (bestStart >= 0 && bestLen >= minGutterBins) {
    const midBin = bestStart + bestLen / 2;
    splitFromBins = (midBin / bins) * imageWidth;
  }

  // Fallback: mayor salto entre centros de palabra cerca del centro
  const mids: number[] = [];
  for (const line of lines) {
    if (line.words && line.words.length > 0) {
      for (const w of line.words) mids.push((w.bbox.x0 + w.bbox.x1) / 2);
    } else {
      mids.push(lineMidX(line));
    }
  }
  mids.sort((a, b) => a - b);

  const pageMid = imageWidth / 2;
  let bestScore = 0;
  let bestSplit: number | null = null;
  for (let i = 0; i < mids.length - 1; i++) {
    const leftMid = mids[i]!;
    const rightMid = mids[i + 1]!;
    const gap = rightMid - leftMid;
    if (gap < imageWidth * 0.05) continue;
    const gapCenter = (leftMid + rightMid) / 2;
    const centerBias = 1 - Math.min(1, Math.abs(gapCenter - pageMid) / (imageWidth * 0.35));
    const score = gap * (0.35 + 0.65 * centerBias);
    if (score > bestScore) {
      bestScore = score;
      bestSplit = gapCenter;
    }
  }

  const fromGap =
    bestSplit != null && bestScore >= imageWidth * 0.045 ? bestSplit : null;

  // Preferencia: pixel/hint → bins → gap entre palabras
  const candidates = [preferredSplitX ?? null, splitFromBins, fromGap].filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );
  if (candidates.length === 0) return null;

  // Elige el candidato más cercano al centro de la página (divisor típico)
  candidates.sort(
    (a, b) => Math.abs(a - pageMid) - Math.abs(b - pageMid),
  );
  return candidates[0]!;
}

/**
 * Detecta un gutter / línea vertical por proyección de tinta en la zona central.
 */
export function findPixelGutterX(canvas: HTMLCanvasElement): number | null {
  const width = canvas.width;
  const height = canvas.height;
  if (width < 200 || height < 200) return null;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const { data } = ctx.getImageData(0, 0, width, height);
  const ink = new Float64Array(width);
  const darkThreshold = 145;
  // Cuerpo de la carta (evita cabecera/logo y pie ilustrado)
  const y0 = Math.floor(height * 0.14);
  const y1 = Math.floor(height * 0.88);

  for (let y = y0; y < y1; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4]! < darkThreshold) ink[x] += 1;
    }
  }

  const smooth = new Float64Array(width);
  const radius = Math.max(2, Math.floor(width * 0.006));
  for (let x = 0; x < width; x++) {
    let sum = 0;
    let n = 0;
    for (let k = -radius; k <= radius; k++) {
      const i = x + k;
      if (i < 0 || i >= width) continue;
      sum += ink[i]!;
      n += 1;
    }
    smooth[x] = sum / n;
  }

  const lo = Math.floor(width * 0.3);
  const hi = Math.ceil(width * 0.7);
  const pageMid = width / 2;
  let bestX = -1;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let x = lo; x < hi; x++) {
    const centerBias = 1 + Math.abs(x - pageMid) / (width * 0.5);
    const score = smooth[x]! * centerBias;
    if (score < bestScore) {
      bestScore = score;
      bestX = x;
    }
  }
  if (bestX < 0) return null;

  const leftAvg = averageRange(smooth, Math.floor(width * 0.08), Math.floor(width * 0.26));
  const rightAvg = averageRange(smooth, Math.ceil(width * 0.74), Math.floor(width * 0.92));
  const sideAvg = (leftAvg + rightAvg) / 2;
  if (sideAvg <= 0) return null;
  // Valle claro (línea o hueco entre columnas)
  if (smooth[bestX]! > sideAvg * 0.55) return null;
  return bestX;
}

function averageRange(values: Float64Array, from: number, to: number): number {
  const a = Math.max(0, Math.min(values.length, from));
  const b = Math.max(a + 1, Math.min(values.length, to));
  let sum = 0;
  for (let i = a; i < b; i++) sum += values[i]!;
  return sum / (b - a);
}

/**
 * Separa líneas en columnas (izq → der). Líneas a ancho completo (cabecera)
 * van en un bloque previo. Si no hay 2 columnas claras, devuelve una sola.
 */
export function splitLinesIntoColumns(
  lines: OcrLine[],
  imageWidth: number,
  preferredSplitX?: number | null,
): OcrLine[][] {
  if (lines.length === 0) return [];

  const splitX = findColumnSplitX(lines, imageWidth, preferredSplitX);
  if (splitX == null) {
    return [sortReadingOrder(lines)];
  }

  const left: OcrLine[] = [];
  const right: OcrLine[] = [];
  const spanning: OcrLine[] = [];
  const gutterPad = Math.max(8, imageWidth * 0.012);

  for (const line of lines) {
    const width = line.bbox.x1 - line.bbox.x0;
    const crossesGutter =
      line.bbox.x0 < splitX - gutterPad && line.bbox.x1 > splitX + gutterPad;

    // Cabeceras / títulos a ancho de página
    if (crossesGutter && width >= imageWidth * 0.5) {
      spanning.push(line);
      continue;
    }

    if (lineMidX(line) < splitX) left.push(line);
    else right.push(line);
  }

  const minPerCol = Math.max(2, Math.floor(lines.length * 0.12));
  if (left.length < minPerCol || right.length < minPerCol) {
    return [sortReadingOrder(lines)];
  }

  const columns: OcrLine[][] = [];
  if (spanning.length > 0) columns.push(sortReadingOrder(spanning));
  columns.push(sortReadingOrder(left));
  columns.push(sortReadingOrder(right));
  return columns;
}

const PRICE_TOKEN_RE =
  /\d+[.,]\d{2}\s*€?|\b\d{1,3}\s*€|€\s*\d|\b\d+[.,]\d{2}\b/i;

function hasPriceToken(text: string): boolean {
  return PRICE_TOKEN_RE.test(text);
}

/** Categorías habituales de carta (ES/CAT) — refuerzo de detección de títulos. */
const SECTION_NAME_RE =
  /^(tapas?|tapes|bikinis?|hamburgueses?|hamburguesas?|pizzes?|pizzas?|entrepans?|bocadillos?|bocatas?|frankfurts?|amanides?|ensaladas?|postres?|begudes?|bebidas?|caf[eè]s?|vins?|vinos?|combinats?|menus?|primer(?:s|os)?|segon(?:s|os)?|carn|peix|pescado|arro[cs]e?s?|pasta|especialitats?|especialidades?)$/i;

/**
 * Detecta si una línea es título/categoría de carta (Tapas, Hamburguesas…).
 * Patrón esperado: capa título → capa con todo el contenido debajo → repetir.
 */
function isLikelySectionTitle(
  line: OcrLine,
  index: number,
  sorted: OcrLine[],
  medianH: number,
  medianGap: number,
): boolean {
  const text = line.text.trim();
  if (!text || hasPriceToken(text)) return false;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 5) return false;
  if (text.length > 36) return false;

  let score = 0;
  const h = lineHeight(line);
  const letters = text.replace(/[^a-zA-ZÁÉÍÓÚÜÑáéíóúüñÇç]/g, '');
  const isAllCaps =
    letters.length >= 3 && letters === letters.toUpperCase();

  if (SECTION_NAME_RE.test(text.replace(/\s+/g, ' ').trim())) score += 5;
  if (isAllCaps && words.length <= 3) score += 4;
  if (isAllCaps && words.length === 1) score += 2;

  if (h >= medianH * 1.15) score += 2;
  if (h >= medianH * 1.4) score += 1;
  if (words.length <= 3) score += 1;
  if (words.length <= 2) score += 1;
  if (text.length <= 22) score += 1;

  if (index > 0) {
    const prev = sorted[index - 1]!;
    const gap = line.bbox.y0 - prev.bbox.y1;
    if (medianGap > 0 && gap >= medianGap * 1.5) score += 2;
    if (medianGap > 0 && gap >= medianGap * 2.2) score += 1;
    // Tras un bloque de ítems con precio, un corto en mayúsculas suele ser categoría
    if (hasPriceToken(prev.text) && isAllCaps && words.length <= 3) score += 2;
  } else {
    score += 1;
  }

  return score >= 4;
}

export interface MenuTextBlock {
  role: 'title' | 'body';
  text: string;
  bbox: OcrBBox;
  /** Altura media de línea OCR → tamaño de fuente */
  avgLineHeight: number;
}

/** Agrupa títulos/contenido dentro de una sola columna (orden de lectura ya aplicado). */
function groupSingleColumnByTitles(lines: OcrLine[]): MenuTextBlock[] {
  if (lines.length === 0) return [];

  const sorted = sortReadingOrder(lines);
  const heights = sorted.map(lineHeight);
  const medianH = median(heights) || 16;

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(Math.max(0, sorted[i]!.bbox.y0 - sorted[i - 1]!.bbox.y1));
  }
  const medianGap = median(gaps) || medianH * 0.4;

  let titleFlags = sorted.map((line, index) =>
    isLikelySectionTitle(line, index, sorted, medianH, medianGap),
  );

  // Si no hay títulos, reintento más permisivo: mayúsculas cortas sin precio
  if (!titleFlags.some(Boolean)) {
    titleFlags = sorted.map((line) => {
      const text = line.text.trim();
      if (!text || hasPriceToken(text)) return false;
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length === 0 || words.length > 3 || text.length > 28) return false;
      const letters = text.replace(/[^a-zA-ZÁÉÍÓÚÜÑáéíóúüñÇç]/g, '');
      return letters.length >= 3 && letters === letters.toUpperCase();
    });
  }

  if (!titleFlags.some(Boolean)) {
    return [
      {
        role: 'body',
        text: sorted.map((l) => l.text).join('\n'),
        bbox: unionBBox(sorted.map((l) => l.bbox)),
        avgLineHeight: medianH,
      },
    ];
  }

  const blocks: MenuTextBlock[] = [];
  let pendingBody: OcrLine[] = [];

  const flushBody = () => {
    if (pendingBody.length === 0) return;
    blocks.push({
      role: 'body',
      text: pendingBody.map((l) => l.text).join('\n'),
      bbox: unionBBox(pendingBody.map((l) => l.bbox)),
      avgLineHeight: median(pendingBody.map(lineHeight)) || medianH,
    });
    pendingBody = [];
  };

  for (let i = 0; i < sorted.length; i++) {
    const line = sorted[i]!;
    if (titleFlags[i]) {
      flushBody();
      blocks.push({
        role: 'title',
        text: line.text,
        bbox: { ...line.bbox },
        avgLineHeight: lineHeight(line),
      });
    } else {
      pendingBody.push(line);
    }
  }
  flushBody();

  return blocks;
}

/**
 * Agrupa líneas OCR en secciones: título + bloque de contenido multilínea.
 * Si hay 2 columnas (hueco/línea vertical), procesa cada columna por separado.
 */
export function groupOcrLinesByTitles(
  lines: OcrLine[],
  imageWidth?: number,
  preferredSplitX?: number | null,
): MenuTextBlock[] {
  if (lines.length === 0) return [];

  const width = imageWidth && imageWidth > 0 ? imageWidth : inferImageWidth(lines);
  const columns = splitLinesIntoColumns(lines, width, preferredSplitX);

  const blocks: MenuTextBlock[] = [];
  for (const column of columns) {
    blocks.push(...groupSingleColumnByTitles(column));
  }
  return blocks;
}

export function ocrBlockToTextLayer(
  block: MenuTextBlock,
  imageWidth: number,
  imageHeight: number,
  zIndex: number,
): TextLayer {
  const mapped = mapImageRectToA4Cover(block.bbox, imageWidth, imageHeight);
  const iw = Math.max(imageWidth, 1);
  const ih = Math.max(imageHeight, 1);
  const scale = Math.max(A4_WIDTH / iw, A4_HEIGHT / ih);
  const fontFromLines = Math.max(9, Math.min(42, block.avgLineHeight * scale * 0.82));

  const isTitle = block.role === 'title';
  const fontSize = isTitle
    ? Math.max(fontFromLines, Math.min(48, mapped.fontSize * 1.05))
    : Math.min(fontFromLines, 22);

  const label = isTitle ? block.text.slice(0, 36) : block.text.split('\n')[0]?.slice(0, 36) ?? 'Contenido';

  return {
    id: `layer_${crypto.randomUUID().slice(0, 8)}`,
    type: 'text',
    name: isTitle ? `Título: ${label}` : `Contenido: ${label}`,
    content: block.text,
    x: mapped.x,
    y: mapped.y,
    width: Math.max(mapped.width, isTitle ? 80 : 120),
    height: Math.max(mapped.height, fontSize * (block.text.split('\n').length + 0.5)),
    rotation: 0,
    zIndex,
    style: {
      fontFamily: 'Arial',
      fontSize,
      color: '#1a1a1a',
      align: 'left',
      fontWeight: isTitle ? 'bold' : 'normal',
    },
  };
}

export function buildTextLayersFromOcr(
  lines: OcrLine[],
  imageWidth: number,
  imageHeight: number,
  options: { groupByTitles: boolean; columnSplitX?: number | null },
): TextLayer[] {
  if (!options.groupByTitles) {
    // Una capa por línea, pero en orden de columnas (izq → der) si aplica
    const ordered = splitLinesIntoColumns(
      lines,
      imageWidth,
      options.columnSplitX,
    ).flat();
    return ordered.map((line, index) =>
      ocrLineToTextLayer(line, imageWidth, imageHeight, index + 1),
    );
  }

  const blocks = groupOcrLinesByTitles(lines, imageWidth, options.columnSplitX);
  return blocks.map((block, index) =>
    ocrBlockToTextLayer(block, imageWidth, imageHeight, index + 1),
  );
}

export async function recognizeMenuImage(
  file: Blob,
  onProgress?: (percent: number, status: string) => void,
  languages: string[] = resolveOcrLanguages(DEFAULT_OCR_LANGUAGE),
): Promise<MenuImageOcrResult> {
  onProgress?.(0, 'Preparando imagen…');
  const prepared = await prepareImageForOcr(file);

  const langs = languages.length > 0 ? languages : resolveOcrLanguages(DEFAULT_OCR_LANGUAGE);
  const langLabel = langs.join('+').toUpperCase();

  onProgress?.(8, 'Cargando motor OCR…');
  const { createWorker, PSM } = await import('tesseract.js');

  // blocks hay que pedirlo explícitamente (en tesseract.js v5+ solo text viene activo).
  const worker = await createWorker(langs, undefined, {
    logger: (message) => {
      if (message.status === 'loading tesseract core') {
        onProgress?.(12, 'Cargando motor OCR…');
      } else if (message.status === 'initializing tesseract') {
        onProgress?.(16, 'Inicializando OCR…');
      } else if (message.status === 'loading language traineddata') {
        onProgress?.(22, `Cargando idioma (${langLabel})…`);
      } else if (message.status === 'recognizing text') {
        onProgress?.(28 + Math.round((message.progress ?? 0) * 68), 'Reconociendo texto…');
      }
    },
  });

  try {
    /**
     * Página completa (sin recortar): el título y HAMBURGUESES cruzan el centro.
     * Columnas: se detectan por hueco/línea vertical y se separan después
     * (palabras + proyección de tinta), luego título → contenido por columna.
     */
    onProgress?.(26, 'Reconociendo texto (página completa)…');
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    });

    const { data } = await worker.recognize(prepared.blob, {}, { blocks: true, text: true });

    let lines = extractOcrLines(data);
    if (lines.length === 0 && data.text?.trim()) {
      lines = linesFromPlainText(data.text, prepared.width, prepared.height);
    }

    const pixelGutter = findPixelGutterX(prepared.canvas);
    lines = mergeFragmentedOcrLines(lines, pixelGutter);
    lines = splitCrossColumnOcrLines(lines, prepared.width, pixelGutter);
    lines = normalizeOcrLines(lines);
    onProgress?.(100, 'OCR completado');

    return {
      lines,
      imageWidth: prepared.width,
      imageHeight: prepared.height,
      columnSplitX: findColumnSplitX(lines, prepared.width, pixelGutter),
    };
  } finally {
    await worker.terminate();
  }
}

export async function applyMenuImportToCanvas(
  canvas: Canvas,
  params: {
    imageUrl: string;
    assetId: string;
    lines: OcrLine[];
    imageWidth: number;
    imageHeight: number;
    groupByTitles?: boolean;
    columnSplitX?: number | null;
  },
): Promise<number> {
  canvas.clear();
  canvas.backgroundImage = undefined;
  canvas.backgroundColor = '#FAF6F0';

  const bgLayerId = `layer_${crypto.randomUUID().slice(0, 8)}`;
  const bgLayer = {
    id: bgLayerId,
    type: 'image' as const,
    name: 'Carta (fondo)',
    src: params.imageUrl,
    assetId: params.assetId,
    x: 0,
    y: 0,
    width: params.imageWidth,
    height: params.imageHeight,
    rotation: 0,
    zIndex: 0,
    locked: true,
  };

  const img = await imageLayerToFabricObject(bgLayer);
  (img as import('fabric').FabricObject & { data?: Record<string, unknown> }).data = {
    ...((img as import('fabric').FabricObject & { data?: Record<string, unknown> }).data ?? {}),
    assetId: params.assetId,
    src: params.imageUrl,
    layerType: 'image',
    layerId: bgLayerId,
    layerName: bgLayer.name,
    locked: true,
  };

  canvas.add(img);
  fitImageToA4(img, canvas, 'cover');

  const textLayers = buildTextLayersFromOcr(
    params.lines,
    params.imageWidth,
    params.imageHeight,
    {
      groupByTitles: params.groupByTitles === true,
      columnSplitX: params.columnSplitX,
    },
  );

  let zIndex = 1;
  for (const layer of textLayers) {
    layer.zIndex = zIndex;
    zIndex += 1;
    await addLayerToCanvas(canvas, layer);
  }

  canvas.discardActiveObject();
  canvas.requestRenderAll();

  return textLayers.length;
}
