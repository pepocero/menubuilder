import type { Canvas } from 'fabric';
import type { TextLayer } from '@/types/canvas';
import { A4_HEIGHT, A4_WIDTH } from '@/types/canvas';
import {
  addLayerToCanvas,
  fitImageToA4,
  imageLayerToFabricObject,
} from '@/lib/canvas-serializer';
import type { MenuOcrResult, MenuOcrSection } from '@shared/menu-ocr';

function pct(n: number, total: number): number {
  return (n / 100) * total;
}

function buildSectionLayers(
  sections: MenuOcrSection[],
  startZ: number,
): TextLayer[] {
  const layers: TextLayer[] = [];
  let z = startZ;

  const byColumn = {
    full: sections.filter((s) => s.column === 'full').sort((a, b) => a.order - b.order),
    left: sections.filter((s) => s.column === 'left').sort((a, b) => a.order - b.order),
    right: sections.filter((s) => s.column === 'right').sort((a, b) => a.order - b.order),
  };

  const layout = {
    full: { x: pct(6, A4_WIDTH), width: pct(88, A4_WIDTH) },
    left: { x: pct(5, A4_WIDTH), width: pct(43, A4_WIDTH) },
    right: { x: pct(52, A4_WIDTH), width: pct(43, A4_WIDTH) },
  } as const;

  const cursorY: Record<'full' | 'left' | 'right', number> = {
    full: pct(18, A4_HEIGHT),
    left: pct(18, A4_HEIGHT),
    right: pct(18, A4_HEIGHT),
  };

  // Si hay full + columnas, las full van primero arriba y desplazan el inicio de columnas
  const pushSection = (section: MenuOcrSection, col: 'full' | 'left' | 'right') => {
    const { x, width } = layout[col];
    let y = cursorY[col];

    if (section.title) {
      const titleH = 22;
      layers.push({
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
          fontSize: 16,
          color: '#1a1a1a',
          align: 'left',
          fontWeight: 'bold',
        },
      });
      y += titleH + 6;
    }

    if (section.body) {
      const lines = section.body.split(/\n/).filter((l) => l.trim()).length;
      const fontSize = 11;
      const height = Math.max(28, lines * (fontSize * 1.35) + 8);
      layers.push({
        id: `layer_${crypto.randomUUID().slice(0, 8)}`,
        type: 'text',
        name: `Contenido: ${(section.title || section.body).slice(0, 36)}`,
        content: section.body,
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
      });
      y += height + 14;
    }

    cursorY[col] = y;
    if (col === 'full') {
      cursorY.left = Math.max(cursorY.left, y);
      cursorY.right = Math.max(cursorY.right, y);
    }
  };

  for (const section of byColumn.full) pushSection(section, 'full');
  for (const section of byColumn.left) pushSection(section, 'left');
  for (const section of byColumn.right) pushSection(section, 'right');

  return layers;
}

/** Coloca la imagen de fondo y las capas título/contenido del OCR por visión. */
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

  const textLayers: TextLayer[] = [];
  let z = 1;

  if (params.menu.headerTitle) {
    textLayers.push({
      id: `layer_${crypto.randomUUID().slice(0, 8)}`,
      type: 'text',
      name: `Cabecera: ${params.menu.headerTitle.slice(0, 36)}`,
      content: params.menu.headerTitle,
      x: pct(28, A4_WIDTH),
      y: pct(3, A4_HEIGHT),
      width: pct(66, A4_WIDTH),
      height: 28,
      rotation: 0,
      zIndex: z++,
      style: {
        fontFamily: 'Arial',
        fontSize: 18,
        color: '#1a1a1a',
        align: 'left',
        fontWeight: 'bold',
      },
    });
  }

  if (params.menu.headerSubtitle) {
    textLayers.push({
      id: `layer_${crypto.randomUUID().slice(0, 8)}`,
      type: 'text',
      name: 'Subtítulo',
      content: params.menu.headerSubtitle,
      x: pct(28, A4_WIDTH),
      y: pct(7.5, A4_HEIGHT),
      width: pct(66, A4_WIDTH),
      height: 36,
      rotation: 0,
      zIndex: z++,
      style: {
        fontFamily: 'Arial',
        fontSize: 11,
        color: '#1a1a1a',
        align: 'left',
        fontWeight: 'normal',
      },
    });
  }

  textLayers.push(...buildSectionLayers(params.menu.sections, z));

  for (const layer of textLayers) {
    await addLayerToCanvas(canvas, layer);
  }

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
