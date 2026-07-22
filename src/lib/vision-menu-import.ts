import type { Canvas, FabricObject, Textbox } from 'fabric';
import type { TextLayer } from '@/types/canvas';
import { A4_HEIGHT, A4_WIDTH } from '@/types/canvas';
import {
  addLayerToCanvas,
  fitImageToA4,
  imageLayerToFabricObject,
  isTextObject,
  refreshTextboxLayout,
} from '@/lib/canvas-serializer';
import { mapImageRectToA4Cover, type OcrBBox } from '@/lib/menu-image-import';
import {
  isUsableOcrBox,
  type MenuOcrBox,
  type MenuOcrResult,
  type MenuOcrSection,
} from '@shared/menu-ocr';

/** Margen mínimo del lienzo (modo cajas): no sacar texto fuera del A4. */
const EDGE_PAD = 4;
const CANVAS_BOUNDS = {
  left: EDGE_PAD,
  top: EDGE_PAD,
  right: A4_WIDTH - EDGE_PAD,
  bottom: A4_HEIGHT - EDGE_PAD,
} as const;

/** Área segura más holgada para el fallback sin cajas. */
const SAFE_INSET_X = Math.round((4 / 100) * A4_WIDTH);
const SAFE_INSET_Y = Math.round((3.5 / 100) * A4_HEIGHT);
const SAFE = {
  left: SAFE_INSET_X,
  top: SAFE_INSET_Y,
  right: A4_WIDTH - SAFE_INSET_X,
  bottom: A4_HEIGHT - SAFE_INSET_Y,
  width: A4_WIDTH - SAFE_INSET_X * 2,
  height: A4_HEIGHT - SAFE_INSET_Y * 2,
} as const;

const MIN_LAYER_W = 48;
const MIN_LAYER_H = 18;
const MIN_TITLE_H = 18;
const MIN_BODY_H = 22;

function pct(n: number, total: number): number {
  return (n / 100) * total;
}

function estimateTextHeight(lines: number, fontSize: number, padding = 8): number {
  return Math.max(MIN_BODY_H, lines * (fontSize * 1.35) + padding);
}

function pctBoxToImageBBox(box: MenuOcrBox, imageWidth: number, imageHeight: number): OcrBBox {
  const iw = Math.max(imageWidth, 1);
  const ih = Math.max(imageHeight, 1);
  const x0 = (box.x / 100) * iw;
  const y0 = (box.y / 100) * ih;
  const x1 = x0 + (box.w / 100) * iw;
  const y1 = y0 + (box.h / 100) * ih;
  return { x0, y0, x1, y1 };
}

function clampRectToBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  bounds = CANVAS_BOUNDS,
): { x: number; y: number; width: number; height: number } | null {
  if (y >= bounds.bottom - MIN_LAYER_H) return null;
  if (x >= bounds.right - MIN_LAYER_W) return null;

  const nx = Math.max(bounds.left, Math.min(x, bounds.right - MIN_LAYER_W));
  const ny = Math.max(bounds.top, Math.min(y, bounds.bottom - MIN_LAYER_H));
  const nw = Math.min(Math.max(width, MIN_LAYER_W), bounds.right - nx);
  const nh = Math.min(Math.max(height, MIN_LAYER_H), bounds.bottom - ny);
  if (nw < MIN_LAYER_W || nh < MIN_LAYER_H) return null;
  return { x: nx, y: ny, width: nw, height: nh };
}

function clampTextLayer(
  layer: TextLayer,
  bounds = CANVAS_BOUNDS,
): TextLayer | null {
  const rect = clampRectToBounds(layer.x, layer.y, layer.width, layer.height, bounds);
  if (!rect) return null;
  return { ...layer, ...rect };
}

function sectionHasLayoutBox(section: MenuOcrSection): boolean {
  return (
    isUsableOcrBox(section.titleBox) ||
    isUsableOcrBox(section.bodyBox) ||
    isUsableOcrBox(section.box)
  );
}

/** Usa layout por cajas si hay suficientes posiciones fiables. */
function shouldUseBBoxLayout(menu: MenuOcrResult): boolean {
  if (isUsableOcrBox(menu.headerTitleBox) || isUsableOcrBox(menu.headerSubtitleBox)) {
    return true;
  }
  const withBox = menu.sections.filter(sectionHasLayoutBox).length;
  if (withBox === 0) return false;
  if (menu.sections.length <= 2) return withBox >= 1;
  return withBox >= Math.max(1, Math.ceil(menu.sections.length * 0.35));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function clampNumber(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

interface ImportTypography {
  header: number;
  title: number;
  body: number;
}

/**
 * Una sola escala tipográfica para toda la importación.
 * Evita que cajas erróneas (p. ej. casi toda la imagen) generen tamaños 11/12/13/16
 * distintos y descuadren el layout.
 */
function computeImportTypography(
  menu: MenuOcrResult,
  imageWidth: number,
  imageHeight: number,
): ImportTypography {
  const lineHeights: number[] = [];

  for (const section of menu.sections) {
    const box =
      (isUsableOcrBox(section.bodyBox) && section.bodyBox) ||
      (isUsableOcrBox(section.box) && section.box) ||
      null;
    if (!box || !section.body?.trim()) continue;

    const mapped = mapImageRectToA4Cover(
      pctBoxToImageBBox(box, imageWidth, imageHeight),
      imageWidth,
      imageHeight,
    );
    const lines = section.body.split(/\n/).filter((l) => l.trim()).length || 1;

    // Cajas patológicas (bloque enorme con pocas líneas) contaminan la mediana.
    if (mapped.height > A4_HEIGHT * 0.32 && lines < 6) continue;
    if (box.h > 40 && lines < 6) continue;

    const perLine = mapped.height / lines;
    if (perLine >= 8 && perLine <= 28) lineHeights.push(perLine);
  }

  for (const section of menu.sections) {
    if (!section.title || !isUsableOcrBox(section.titleBox)) continue;
    const mapped = mapImageRectToA4Cover(
      pctBoxToImageBBox(section.titleBox, imageWidth, imageHeight),
      imageWidth,
      imageHeight,
    );
    if (mapped.height >= 10 && mapped.height <= 36 && section.titleBox!.h <= 12) {
      lineHeights.push(mapped.height);
    }
  }

  // Cuerpo ~11pt estable; título y cabecera proporcionales fijos (no por caja).
  const medianLine = median(lineHeights);
  const body = Math.round(
    medianLine > 0 ? clampNumber(medianLine * 0.72, 10, 12) : 11,
  );
  const title = Math.round(clampNumber(body * 1.27, 13, 15));
  const header = Math.round(clampNumber(body * 1.55, 15, 18));

  return { header, title, body };
}

function layerFromPctBox(params: {
  content: string;
  box: MenuOcrBox;
  imageWidth: number;
  imageHeight: number;
  zIndex: number;
  role: 'header' | 'title' | 'body';
  name: string;
  fonts: ImportTypography;
}): TextLayer | null {
  const bbox = pctBoxToImageBBox(params.box, params.imageWidth, params.imageHeight);
  const mapped = mapImageRectToA4Cover(bbox, params.imageWidth, params.imageHeight);
  const lines = params.content.split(/\n/).filter((l) => l.trim()).length || 1;
  const fontSize = params.fonts[params.role];

  // Posición/ancho desde la caja; altura natural con tipografía unificada.
  const height = estimateTextHeight(lines, fontSize, params.role === 'body' ? 4 : 2);

  return clampTextLayer({
    id: `layer_${crypto.randomUUID().slice(0, 8)}`,
    type: 'text',
    name: params.name,
    content: params.content,
    x: mapped.x,
    y: mapped.y,
    width: Math.max(mapped.width, params.role === 'title' ? 72 : 100),
    height,
    rotation: 0,
    zIndex: params.zIndex,
    style: {
      fontFamily: 'Arial',
      fontSize,
      color: '#1a1a1a',
      align: 'left',
      fontWeight: params.role === 'body' ? 'normal' : 'bold',
    },
  });
}

function splitSectionBox(box: MenuOcrBox, hasTitle: boolean): {
  titleBox: MenuOcrBox | null;
  bodyBox: MenuOcrBox;
} {
  if (!hasTitle) return { titleBox: null, bodyBox: box };
  const titleH = Math.max(1.2, Math.min(box.h * 0.18, 6));
  return {
    titleBox: { x: box.x, y: box.y, w: box.w, h: titleH },
    bodyBox: {
      x: box.x,
      y: box.y + titleH,
      w: box.w,
      h: Math.max(1, box.h - titleH),
    },
  };
}

function buildLayersFromBoxes(
  menu: MenuOcrResult,
  imageWidth: number,
  imageHeight: number,
): TextLayer[] {
  const layers: TextLayer[] = [];
  let z = 1;
  const sectionsWithoutBox: MenuOcrSection[] = [];
  const fonts = computeImportTypography(menu, imageWidth, imageHeight);

  if (menu.headerTitle) {
    if (isUsableOcrBox(menu.headerTitleBox)) {
      const layer = layerFromPctBox({
        content: menu.headerTitle,
        box: menu.headerTitleBox!,
        imageWidth,
        imageHeight,
        zIndex: z++,
        role: 'header',
        name: `Cabecera: ${menu.headerTitle.slice(0, 36)}`,
        fonts,
      });
      if (layer) layers.push(layer);
    } else {
      const layer = layerFromPctBox({
        content: menu.headerTitle,
        box: { x: 28, y: 2, w: 66, h: 4 },
        imageWidth,
        imageHeight,
        zIndex: z++,
        role: 'header',
        name: `Cabecera: ${menu.headerTitle.slice(0, 36)}`,
        fonts,
      });
      if (layer) layers.push(layer);
    }
  }

  if (menu.headerSubtitle) {
    if (isUsableOcrBox(menu.headerSubtitleBox)) {
      const layer = layerFromPctBox({
        content: menu.headerSubtitle,
        box: menu.headerSubtitleBox!,
        imageWidth,
        imageHeight,
        zIndex: z++,
        role: 'body',
        name: 'Subtítulo',
        fonts,
      });
      if (layer) layers.push(layer);
    } else {
      const layer = layerFromPctBox({
        content: menu.headerSubtitle,
        box: { x: 28, y: 6.5, w: 66, h: 5 },
        imageWidth,
        imageHeight,
        zIndex: z++,
        role: 'body',
        name: 'Subtítulo',
        fonts,
      });
      if (layer) layers.push(layer);
    }
  }

  const sections = [...menu.sections].sort((a, b) => {
    const ay = a.titleBox?.y ?? a.bodyBox?.y ?? a.box?.y ?? a.order;
    const by = b.titleBox?.y ?? b.bodyBox?.y ?? b.box?.y ?? b.order;
    if (Math.abs(ay - by) > 0.5) return ay - by;
    const ax = a.titleBox?.x ?? a.bodyBox?.x ?? a.box?.x ?? 0;
    const bx = b.titleBox?.x ?? b.bodyBox?.x ?? b.box?.x ?? 0;
    return ax - bx;
  });

  for (const section of sections) {
    if (!sectionHasLayoutBox(section)) {
      sectionsWithoutBox.push(section);
      continue;
    }

    let titleBox = isUsableOcrBox(section.titleBox) ? section.titleBox! : null;
    let bodyBox = isUsableOcrBox(section.bodyBox) ? section.bodyBox! : null;

    if ((!titleBox || !bodyBox) && isUsableOcrBox(section.box)) {
      const split = splitSectionBox(section.box!, !!section.title);
      if (!titleBox) titleBox = split.titleBox;
      if (!bodyBox) bodyBox = split.bodyBox;
    }

    // Si solo hay titleBox y hay body, colocar body justo debajo del título.
    if (titleBox && !bodyBox && section.body) {
      bodyBox = {
        x: titleBox.x,
        y: titleBox.y + titleBox.h + 0.4,
        w: titleBox.w,
        h: Math.max(3, Math.min(28, 100 - (titleBox.y + titleBox.h + 0.4))),
      };
    }

    // Si solo hay bodyBox y hay title, colocar title encima.
    if (bodyBox && !titleBox && section.title) {
      const titleH = Math.max(1.5, Math.min(bodyBox.h * 0.2, 5));
      titleBox = {
        x: bodyBox.x,
        y: Math.max(0, bodyBox.y - titleH - 0.3),
        w: bodyBox.w,
        h: titleH,
      };
    }

    if (section.title && titleBox) {
      const layer = layerFromPctBox({
        content: section.title,
        box: titleBox,
        imageWidth,
        imageHeight,
        zIndex: z++,
        role: 'title',
        name: `Título: ${section.title.slice(0, 36)}`,
        fonts,
      });
      if (layer) layers.push(layer);
    }

    if (section.body && bodyBox) {
      const layer = layerFromPctBox({
        content: section.body,
        box: bodyBox,
        imageWidth,
        imageHeight,
        zIndex: z++,
        role: 'body',
        name: `Contenido: ${(section.title || section.body).slice(0, 36)}`,
        fonts,
      });
      if (layer) layers.push(layer);
    }
  }

  if (sectionsWithoutBox.length > 0) {
    const startY =
      layers.reduce((max, l) => Math.max(max, l.y + l.height), SAFE.top + pct(14, A4_HEIGHT)) +
      12;
    layers.push(
      ...buildSectionLayersFallback(
        sectionsWithoutBox,
        z,
        Math.min(startY, SAFE.bottom - MIN_LAYER_H),
        fonts,
      ),
    );
  }

  return layers;
}

function buildSectionLayersFallback(
  sections: MenuOcrSection[],
  startZ: number,
  startY: number,
  fonts: ImportTypography = { header: 16, title: 14, body: 11 },
): TextLayer[] {
  const layers: TextLayer[] = [];
  let z = startZ;

  const byColumn = {
    full: sections.filter((s) => s.column === 'full').sort((a, b) => a.order - b.order),
    left: sections.filter((s) => s.column === 'left').sort((a, b) => a.order - b.order),
    right: sections.filter((s) => s.column === 'right').sort((a, b) => a.order - b.order),
  };

  const fullX = SAFE.left + pct(2, A4_WIDTH);
  const leftX = SAFE.left;
  const rightX = SAFE.left + pct(47, A4_WIDTH);
  const layout = {
    full: { x: fullX, width: Math.min(SAFE.width - pct(4, A4_WIDTH), SAFE.right - fullX) },
    left: { x: leftX, width: Math.min(pct(43, A4_WIDTH), SAFE.right - leftX) },
    right: { x: rightX, width: Math.min(pct(43, A4_WIDTH), SAFE.right - rightX) },
  } as const;

  const cursorY: Record<'full' | 'left' | 'right', number> = {
    full: startY,
    left: startY,
    right: startY,
  };

  const pushSection = (section: MenuOcrSection, col: 'full' | 'left' | 'right') => {
    const { x, width } = layout[col];
    let y = cursorY[col];
    if (y >= SAFE.bottom - MIN_LAYER_H) return;

    if (section.title) {
      const available = SAFE.bottom - y;
      if (available < MIN_TITLE_H) return;
      const titleH = Math.min(estimateTextHeight(1, fonts.title, 2), available);
      const titleLayer = clampTextLayer(
        {
          id: `layer_${crypto.randomUUID().slice(0, 8)}`,
          type: 'text',
          name: `Título: ${section.title.slice(0, 36)}`,
          content: section.title,
          x,
          y,
          width,
          height: titleH,
          rotation: 0,
          zIndex: z++,
          style: {
            fontFamily: 'Arial',
            fontSize: fonts.title,
            color: '#1a1a1a',
            align: 'left',
            fontWeight: 'bold',
          },
        },
        SAFE,
      );
      if (!titleLayer) return;
      layers.push(titleLayer);
      y = titleLayer.y + titleLayer.height + 6;
    }

    if (section.body) {
      const available = SAFE.bottom - y;
      if (available < MIN_BODY_H) {
        cursorY[col] = y;
        return;
      }

      const fontSize = fonts.body;
      const rawLines = section.body.split(/\n/).filter((l) => l.trim());
      let lines = rawLines;
      let height = estimateTextHeight(Math.max(1, lines.length), fontSize);

      while (height > available && lines.length > 1) {
        lines = lines.slice(0, -1);
        height = estimateTextHeight(lines.length, fontSize);
      }
      height = Math.min(height, available);

      const bodyContent =
        lines.length < rawLines.length ? `${lines.join('\n')}\n…` : section.body;

      const bodyLayer = clampTextLayer(
        {
          id: `layer_${crypto.randomUUID().slice(0, 8)}`,
          type: 'text',
          name: `Contenido: ${(section.title || section.body).slice(0, 36)}`,
          content: bodyContent,
          x,
          y,
          width,
          height,
          rotation: 0,
          zIndex: z++,
          style: {
            fontFamily: 'Arial',
            fontSize,
            color: '#1a1a1a',
            align: 'left',
            fontWeight: 'normal',
          },
        },
        SAFE,
      );
      if (!bodyLayer) {
        cursorY[col] = y;
        return;
      }
      layers.push(bodyLayer);
      y = bodyLayer.y + bodyLayer.height + 14;
    }

    cursorY[col] = Math.min(y, SAFE.bottom);
    if (col === 'full') {
      cursorY.left = Math.max(cursorY.left, cursorY.full);
      cursorY.right = Math.max(cursorY.right, cursorY.full);
    }
  };

  for (const section of byColumn.full) pushSection(section, 'full');
  for (const section of byColumn.left) pushSection(section, 'left');
  for (const section of byColumn.right) pushSection(section, 'right');

  return layers;
}

function buildFallbackLayers(
  menu: MenuOcrResult,
  startZ = 1,
  fonts: ImportTypography = { header: 16, title: 14, body: 11 },
): TextLayer[] {
  const textLayers: TextLayer[] = [];
  let z = startZ;
  let contentStartY = SAFE.top + pct(12, A4_HEIGHT);

  if (menu.headerTitle) {
    const header = clampTextLayer(
      {
        id: `layer_${crypto.randomUUID().slice(0, 8)}`,
        type: 'text',
        name: `Cabecera: ${menu.headerTitle.slice(0, 36)}`,
        content: menu.headerTitle,
        x: SAFE.left + pct(22, A4_WIDTH),
        y: SAFE.top,
        width: SAFE.width - pct(22, A4_WIDTH),
        height: estimateTextHeight(1, fonts.header, 2),
        rotation: 0,
        zIndex: z++,
        style: {
          fontFamily: 'Arial',
          fontSize: fonts.header,
          color: '#1a1a1a',
          align: 'left',
          fontWeight: 'bold',
        },
      },
      SAFE,
    );
    if (header) {
      textLayers.push(header);
      contentStartY = Math.max(contentStartY, header.y + header.height + 8);
    }
  }

  if (menu.headerSubtitle) {
    const subtitle = clampTextLayer(
      {
        id: `layer_${crypto.randomUUID().slice(0, 8)}`,
        type: 'text',
        name: 'Subtítulo',
        content: menu.headerSubtitle,
        x: SAFE.left + pct(22, A4_WIDTH),
        y: contentStartY,
        width: SAFE.width - pct(22, A4_WIDTH),
        height: estimateTextHeight(
          menu.headerSubtitle.split(/\n/).filter((l) => l.trim()).length || 1,
          fonts.body,
          2,
        ),
        rotation: 0,
        zIndex: z++,
        style: {
          fontFamily: 'Arial',
          fontSize: fonts.body,
          color: '#1a1a1a',
          align: 'left',
          fontWeight: 'normal',
        },
      },
      SAFE,
    );
    if (subtitle) {
      textLayers.push(subtitle);
      contentStartY = Math.max(contentStartY, subtitle.y + subtitle.height + 12);
    }
  }

  contentStartY = Math.min(contentStartY, SAFE.bottom - MIN_LAYER_H);
  textLayers.push(...buildSectionLayersFallback(menu.sections, z, contentStartY, fonts));
  return textLayers;
}

/** Tras fabricar Textbox, solo corrige posición/ancho — no cambia el tamaño de fuente. */
function clampImportedTextObjectsToCanvas(canvas: Canvas): void {
  for (const obj of canvas.getObjects()) {
    if (!isTextObject(obj)) continue;
    const text = obj as Textbox;

    let left = Number(text.left) || 0;
    let top = Number(text.top) || 0;
    let width = Number(text.width) || MIN_LAYER_W;

    left = Math.max(CANVAS_BOUNDS.left, Math.min(left, CANVAS_BOUNDS.right - MIN_LAYER_W));
    top = Math.max(CANVAS_BOUNDS.top, Math.min(top, CANVAS_BOUNDS.bottom - MIN_LAYER_H));
    width = Math.min(Math.max(width, MIN_LAYER_W), CANVAS_BOUNDS.right - left);

    text.set({ left, top, width, dirty: true });
    refreshTextboxLayout(text);

    const h = (text.height ?? 0) * (text.scaleY ?? 1);
    if (top + h > CANVAS_BOUNDS.bottom) {
      top = Math.max(
        CANVAS_BOUNDS.top,
        CANVAS_BOUNDS.bottom - Math.min(h, CANVAS_BOUNDS.bottom - CANVAS_BOUNDS.top),
      );
      text.set({ top, dirty: true });
      text.setCoords();
    }
  }
}

/** Coloca la imagen de fondo y las capas de texto del OCR lo más fieles posible a la foto. */
export async function applyVisionMenuImportToCanvas(
  canvas: Canvas,
  params: {
    imageUrl: string;
    assetId: string;
    imageWidth: number;
    imageHeight: number;
    menu: MenuOcrResult;
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
  (img as FabricObject & { data?: Record<string, unknown> }).data = {
    ...((img as FabricObject & { data?: Record<string, unknown> }).data ?? {}),
    assetId: params.assetId,
    src: params.imageUrl,
    layerType: 'image',
    layerId: bgLayerId,
    layerName: bgLayer.name,
    locked: true,
  };

  canvas.add(img);
  fitImageToA4(img, canvas, 'cover');

  let textLayers: TextLayer[];
  const fonts = computeImportTypography(
    params.menu,
    params.imageWidth,
    params.imageHeight,
  );
  if (shouldUseBBoxLayout(params.menu)) {
    textLayers = buildLayersFromBoxes(
      params.menu,
      params.imageWidth,
      params.imageHeight,
    );
    // Si la IA dio cajas malas y casi no salió nada, cae al layout clásico.
    const expectedBlocks =
      (params.menu.headerTitle ? 1 : 0) +
      (params.menu.headerSubtitle ? 1 : 0) +
      params.menu.sections.reduce(
        (n, s) => n + (s.title ? 1 : 0) + (s.body ? 1 : 0),
        0,
      );
    if (textLayers.length < Math.max(1, Math.ceil(expectedBlocks * 0.4))) {
      textLayers = buildFallbackLayers(params.menu, 1, fonts);
    }
  } else {
    textLayers = buildFallbackLayers(params.menu, 1, fonts);
  }

  for (const layer of textLayers) {
    const safeLayer = clampTextLayer(layer);
    if (!safeLayer) continue;
    await addLayerToCanvas(canvas, safeLayer);
  }

  clampImportedTextObjectsToCanvas(canvas);

  canvas.discardActiveObject();
  canvas.requestRenderAll();
  return textLayers.length;
}

/** Reduce la imagen para enviar a la API de visión (límite de tamaño/coste). */
export async function prepareImageForVisionOcr(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo leer la imagen'));
      el.src = url;
    });

    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error('No se pudo preparar la imagen'));
        },
        'image/jpeg',
        0.92,
      );
    });
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
