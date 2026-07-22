import type { MenuDocument } from '@shared/menu-document/types';
import {
  canvasDataToMenuDocument,
  importJsonToCanvasData,
  serializeMenuDocument,
} from '@shared/menu-document/converter';
import type { CanvasData } from '@/types/canvas';
import { normalizeCanvasData } from '@/types/canvas';
import { jsPDF } from 'jspdf';
import { A4_HEIGHT, A4_WIDTH } from '@/types/canvas';

/** Descarga el MenuDocument v1 como menu.json */
export function exportMenuDocumentJson(data: CanvasData, filename: string, title?: string): void {
  const doc = canvasDataToMenuDocument(data, { title });
  if (!doc) return;

  const json = serializeMenuDocument(doc);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = filename.replace(/[^\w\-áéíóúüñÁÉÍÓÚÜÑ ]+/gi, '_').trim() || 'menu';
  a.download = `${safeName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildMenuDocumentFromCanvas(
  data: CanvasData,
  title?: string,
): MenuDocument | null {
  return canvasDataToMenuDocument(data, { title });
}

/** Lee un .json (MenuDocument o CanvasData) y lo convierte a CanvasData del editor. */
export async function parseMenuJsonFile(file: File): Promise<CanvasData> {
  const { canvas } = await parseMenuImportFile(file);
  return canvas;
}

/** Igual que parseMenuJsonFile, además intenta recuperar el título del documento. */
export async function parseMenuImportFile(
  file: File,
): Promise<{ canvas: CanvasData; title?: string }> {
  const text = await file.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido');
  }

  const imported = importJsonToCanvasData(raw);
  if (!imported) {
    throw new Error(
      'JSON no reconocido. Usa un menu.json exportado desde MenuBuilder o un documento de lienzo válido.',
    );
  }

  let title: string | undefined;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const meta = obj.meta;
    if (meta && typeof meta === 'object') {
      const metaTitle = (meta as { title?: unknown }).title;
      if (typeof metaTitle === 'string' && metaTitle.trim()) {
        title = metaTitle.trim();
      }
    }
    if (!title && typeof obj.title === 'string' && obj.title.trim()) {
      title = obj.title.trim();
    }
  }

  return { canvas: normalizeCanvasData(imported), title };
}

/** Exporta una o varias páginas a un PDF (cada una con su tamaño). */
export function exportPagesToPdf(
  pages: Array<{ dataUrl: string; width: number; height: number }>,
  filename: string,
): void {
  if (pages.length === 0) return;

  const first = pages[0]!;
  const pdf = new jsPDF({
    orientation: first.width >= first.height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [first.width, first.height],
  });

  pages.forEach((page, index) => {
    if (index > 0) {
      pdf.addPage(
        [page.width, page.height],
        page.width >= page.height ? 'landscape' : 'portrait',
      );
    }
    pdf.addImage(page.dataUrl, 'PNG', 0, 0, page.width, page.height, undefined, 'FAST');
  });

  const safeName = filename.replace(/[^\w\-áéíóúüñÁÉÍÓÚÜÑ ]+/gi, '_').trim() || 'carta';
  pdf.save(`${safeName}.pdf`);
}

/** @deprecated usa exportPagesToPdf */
export function exportCanvasToPdf(dataUrl: string, filename: string): void {
  exportPagesToPdf([{ dataUrl, width: A4_WIDTH, height: A4_HEIGHT }], filename);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
