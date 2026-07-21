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
}

export interface MenuImageOcrResult {
  lines: OcrLine[];
  imageWidth: number;
  imageHeight: number;
}

/** Idiomas OCR: «auto» elige según el texto detectado (cat/spa/eng). */
export const OCR_LANGUAGE_PRESETS = [
  {
    id: 'auto',
    label: 'Automático',
    langs: ['spa', 'cat', 'eng'] as const,
    hint: 'Detecta solo el idioma de la carta (recomendado)',
  },
  { id: 'cat', label: 'Català', langs: ['cat'] as const, hint: 'Forzar catalán' },
  { id: 'spa', label: 'Español', langs: ['spa'] as const, hint: 'Forzar castellano' },
  {
    id: 'cat-spa',
    label: 'Català + Español',
    langs: ['cat', 'spa'] as const,
    hint: 'Menús bilingües CAT/ES',
  },
  { id: 'eng', label: 'English', langs: ['eng'] as const, hint: 'Forzar inglés' },
  {
    id: 'spa-eng',
    label: 'Español + English',
    langs: ['spa', 'eng'] as const,
    hint: 'Menús bilingües ES/EN',
  },
] as const;

export type OcrLanguagePresetId = (typeof OCR_LANGUAGE_PRESETS)[number]['id'];

export const DEFAULT_OCR_LANGUAGE: OcrLanguagePresetId = 'auto';

export function resolveOcrLanguages(presetId: OcrLanguagePresetId): string[] {
  const preset = OCR_LANGUAGE_PRESETS.find((p) => p.id === presetId);
  return [...(preset?.langs ?? ['spa', 'cat', 'eng'])];
}

/**
 * Elige idiomas a partir de una muestra de texto OCR (útil si se fuerza un preset).
 * Prioriza catalán si hay marcas claras (·, à/è/ò, léxico CAT).
 */
export function detectOcrLanguagesFromText(sample: string): string[] {
  const t = sample.toLowerCase();
  if (!t.trim()) return ['spa', 'cat', 'eng'];

  const catMarks =
    (t.match(/·/g)?.length ?? 0) * 4 +
    (t.match(/[àèò]/g)?.length ?? 0) * 2 +
    (t.match(/ç/g)?.length ?? 0) * 2 +
    (
      t.match(
        /\b(amb|dels?|unes?|pizzes?|tapes|amanides?|formatge|pernil|tom[aà]quet|enciam|ceba|vedella|hamburgueses|entrepans?|frankfurts?)\b/g,
      )?.length ?? 0
    ) *
      2;

  const spaMarks =
    (t.match(/[áéíóúñ]/g)?.length ?? 0) +
    (
      t.match(
        /\b(con|los|las|una|pizzas?|tapas|ensaladas?|queso|jam[oó]n|tomate|ternera|hamburguesas|bocadillos?)\b/g,
      )?.length ?? 0
    ) *
      2;

  const engMarks =
    (t.match(/\b(with|and|the|cheese|burger|pizza|salad|fries|homemade)\b/g)?.length ?? 0) * 2;

  if (catMarks >= spaMarks && catMarks >= engMarks && catMarks > 0) {
    return spaMarks > 0 ? ['cat', 'spa'] : ['cat'];
  }
  if (engMarks > spaMarks && engMarks > catMarks) {
    return spaMarks > 0 ? ['eng', 'spa'] : ['eng'];
  }
  if (spaMarks > 0) {
    return engMarks > 0 ? ['spa', 'eng'] : ['spa'];
  }
  return ['spa', 'cat', 'eng'];
}

/** Umbral bajo: en cartas decorativas la confianza suele ser peor que en documentos. */
const MIN_CONFIDENCE = 20;
const MIN_TEXT_LENGTH = 1;

type OcrLineNode = {
  text: string;
  confidence: number;
  bbox: OcrBBox;
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

        lines.push({
          text,
          bbox: {
            x0: line.bbox.x0,
            y0: line.bbox.y0,
            x1: line.bbox.x1,
            y1: line.bbox.y1,
          },
          confidence: line.confidence ?? 0,
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
 * Prepara la imagen para OCR: escala razonable y canvas RGB.
 * Tesseract rinde peor con imágenes muy pequeñas o muy grandes.
 */
export async function prepareImageForOcr(file: Blob): Promise<{
  blob: Blob;
  width: number;
  height: number;
}> {
  const dims = await getImageDimensions(file);
  const maxSide = Math.max(dims.width, dims.height);
  const minSide = Math.min(dims.width, dims.height);

  let targetScale = 1;
  if (minSide < 900) {
    targetScale = 900 / minSide;
  } else if (maxSide > 2800) {
    targetScale = 2800 / maxSide;
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
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { blob: file, width: dims.width, height: dims.height };
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

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

    return { blob, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
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
 * Usa un mapa de ocupación en X: el valle vacío cerca del centro suele ser la separación.
 */
export function findColumnSplitX(lines: OcrLine[], imageWidth: number): number | null {
  if (lines.length < 8 || imageWidth < 120) return null;

  const bins = 56;
  const occupancy = new Float64Array(bins);

  for (const line of lines) {
    const start = Math.floor((Math.max(0, line.bbox.x0) / imageWidth) * bins);
    const end = Math.ceil((Math.min(imageWidth, line.bbox.x1) / imageWidth) * bins);
    for (let b = Math.max(0, start); b < Math.min(bins, Math.max(start + 1, end)); b++) {
      occupancy[b] += 1;
    }
  }

  const lo = Math.floor(bins * 0.25);
  const hi = Math.ceil(bins * 0.75);
  const emptyThreshold = Math.max(0.5, lines.length * 0.035);

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

  const minGutterBins = Math.max(2, Math.floor(bins * 0.03));
  if (bestStart >= 0 && bestLen >= minGutterBins) {
    const midBin = bestStart + bestLen / 2;
    return (midBin / bins) * imageWidth;
  }

  // Fallback: mayor salto entre centros de línea cerca del centro de la página
  const byMid = [...lines].sort((a, b) => lineMidX(a) - lineMidX(b));
  const pageMid = imageWidth / 2;
  let bestScore = 0;
  let bestSplit: number | null = null;

  for (let i = 0; i < byMid.length - 1; i++) {
    const leftMid = lineMidX(byMid[i]!);
    const rightMid = lineMidX(byMid[i + 1]!);
    const gap = rightMid - leftMid;
    if (gap < imageWidth * 0.06) continue;

    const gapCenter = (leftMid + rightMid) / 2;
    const centerBias = 1 - Math.min(1, Math.abs(gapCenter - pageMid) / (imageWidth * 0.35));
    const score = gap * (0.4 + 0.6 * centerBias);
    if (score > bestScore) {
      bestScore = score;
      bestSplit = gapCenter;
    }
  }

  if (bestSplit == null || bestScore < imageWidth * 0.05) return null;
  return bestSplit;
}

/**
 * Separa líneas en columnas (izq → der). Líneas a ancho completo (cabecera)
 * van en un bloque previo. Si no hay 2 columnas claras, devuelve una sola.
 */
export function splitLinesIntoColumns(
  lines: OcrLine[],
  imageWidth: number,
): OcrLine[][] {
  if (lines.length === 0) return [];

  const splitX = findColumnSplitX(lines, imageWidth);
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
    if (crossesGutter && width >= imageWidth * 0.42) {
      spanning.push(line);
      continue;
    }

    if (lineMidX(line) < splitX) left.push(line);
    else right.push(line);
  }

  const minPerCol = Math.max(2, Math.floor(lines.length * 0.15));
  if (left.length < minPerCol || right.length < minPerCol) {
    return [sortReadingOrder(lines)];
  }

  const columns: OcrLine[][] = [];
  if (spanning.length > 0) columns.push(sortReadingOrder(spanning));
  columns.push(sortReadingOrder(left));
  columns.push(sortReadingOrder(right));
  return columns;
}

const PRICE_RE =
  /(?:€|\$|£)\s*\d|^\d+[.,]\d{2}\b|\b\d+[.,]\d{2}\s*(?:€|\$|eur|euros?)?\s*$|\d+[.,]\d{2}\s*€|\b\d+\s*€/i;

function looksLikePriceLine(text: string): boolean {
  return PRICE_RE.test(text.trim());
}

function hasPriceToken(text: string): boolean {
  return /\d+[.,]\d{2}|\d+\s*€|€\s*\d/.test(text);
}

/** Categorías típicas de carta (refuerzo; no marca platos como "Classic"). */
const SECTION_NAME_RE =
  /^(tapas?|tapes|bikinis?|hamburgueses?|hamburguesas?|pizzes?|pizzas?|entrepans?|bocadillos?|bocatas?|frankfurts?|amanides?|ensaladas?|postres?|begudes?|bebidas?|caf[eè]s?|vins?|vinos?|menus?|especialitats?|especialidades?)$/i;

/**
 * Detecta título/categoría de carta (TAPES, BIKINIS…).
 * Solo mayúsculas cortas o nombres de sección conocidos — evita marcar platos como título.
 */
function isLikelySectionTitle(
  line: OcrLine,
  index: number,
  sorted: OcrLine[],
  medianH: number,
  medianGap: number,
): boolean {
  const text = line.text.trim();
  if (!text || hasPriceToken(text) || looksLikePriceLine(text)) return false;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  if (text.length > 32) return false;

  const letters = text.replace(/[^a-zA-ZÁÉÍÓÚÜÑáéíóúüñÇç]/g, '');
  const isAllCaps = letters.length >= 3 && letters === letters.toUpperCase();
  const isKnown = SECTION_NAME_RE.test(text);

  // Sin mayúsculas de sección ni nombre conocido → no es título de categoría
  if (!isAllCaps && !isKnown) return false;

  let score = 0;
  const h = lineHeight(line);

  if (isKnown) score += 5;
  if (isAllCaps) score += 3;
  if (words.length <= 2) score += 1;
  if (text.length <= 20) score += 1;
  if (h >= medianH * 1.2) score += 2;
  if (h >= medianH * 1.45) score += 1;

  if (index > 0) {
    const prev = sorted[index - 1]!;
    const gap = line.bbox.y0 - prev.bbox.y1;
    if (medianGap > 0 && gap >= medianGap * 1.75) score += 2;
    if (hasPriceToken(prev.text) && isAllCaps) score += 1;
  } else {
    score += 1;
  }

  return score >= 5;
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

  const titleFlags = sorted.map((line, index) =>
    isLikelySectionTitle(line, index, sorted, medianH, medianGap),
  );

  const titleCount = titleFlags.filter(Boolean).length;
  if (titleCount === 0) {
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
 * Si hay 2 columnas (hueco/divisor vertical), procesa cada columna por separado
 * para no mezclar TAPES con BIKINIS, etc.
 */
export function groupOcrLinesByTitles(
  lines: OcrLine[],
  imageWidth?: number,
): MenuTextBlock[] {
  if (lines.length === 0) return [];

  const width = imageWidth && imageWidth > 0 ? imageWidth : inferImageWidth(lines);
  const columns = splitLinesIntoColumns(lines, width);

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
  options: { groupByTitles: boolean },
): TextLayer[] {
  if (!options.groupByTitles) {
    // Una capa por línea, pero en orden de columnas (izq → der) si aplica
    const ordered = splitLinesIntoColumns(lines, imageWidth).flat();
    return ordered.map((line, index) =>
      ocrLineToTextLayer(line, imageWidth, imageHeight, index + 1),
    );
  }

  const blocks = groupOcrLinesByTitles(lines, imageWidth);
  return blocks.map((block, index) =>
    ocrBlockToTextLayer(block, imageWidth, imageHeight, index + 1),
  );
}

export async function recognizeMenuImage(
  file: Blob,
  onProgress?: (percent: number, status: string) => void,
  languages?: string[],
): Promise<MenuImageOcrResult> {
  onProgress?.(0, 'Preparando imagen…');
  const prepared = await prepareImageForOcr(file);

  onProgress?.(8, 'Cargando motor OCR…');
  const { createWorker, PSM } = await import('tesseract.js');

  const isAuto =
    !languages ||
    languages.length === 0 ||
    (languages.length === 3 &&
      languages.includes('spa') &&
      languages.includes('cat') &&
      languages.includes('eng'));

  const runPass = async (
    langs: string[],
    label: string,
    progressFrom: number,
    progressTo: number,
  ) => {
    const span = Math.max(1, progressTo - progressFrom);
    const worker = await createWorker(langs, undefined, {
      logger: (message) => {
        if (message.status === 'loading language traineddata') {
          onProgress?.(progressFrom, `Cargando ${label}…`);
        } else if (message.status === 'recognizing text') {
          onProgress?.(
            progressFrom + Math.round((message.progress ?? 0) * span),
            'Reconociendo texto…',
          );
        }
      },
    });
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      });
      return await worker.recognize(prepared.blob, {}, { blocks: true, text: true });
    } finally {
      await worker.terminate();
    }
  };

  onProgress?.(12, 'Inicializando OCR…');

  let result = await runPass(
    isAuto ? ['spa', 'cat', 'eng'] : languages!,
    isAuto ? 'idiomas' : languages!.join('+').toUpperCase(),
    20,
    isAuto ? 55 : 98,
  );

  // Automático: afina a cat / spa / eng según la muestra y vuelve a reconocer si conviene.
  if (isAuto && result.data.text?.trim()) {
    const detected = detectOcrLanguagesFromText(result.data.text);
    const alreadyBroad = detected.length >= 3;
    const sameAsBootstrap =
      detected.length === 3 &&
      detected.includes('spa') &&
      detected.includes('cat') &&
      detected.includes('eng');
    if (!alreadyBroad && !sameAsBootstrap && detected.length > 0) {
      onProgress?.(58, `Idioma detectado: ${detected.join('+').toUpperCase()}…`);
      result = await runPass(detected, detected.join('+').toUpperCase(), 60, 98);
    }
  }

  let lines = extractOcrLines(result.data);
  if (lines.length === 0 && result.data.text?.trim()) {
    lines = linesFromPlainText(result.data.text, prepared.width, prepared.height);
  }

  onProgress?.(100, 'OCR completado');

  return {
    lines,
    imageWidth: prepared.width,
    imageHeight: prepared.height,
  };
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
    { groupByTitles: params.groupByTitles === true },
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
