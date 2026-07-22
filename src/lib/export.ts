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

  return normalizeCanvasData(imported);
}

/** Exporta una o varias páginas A4 a un PDF multipágina. */
export function exportPagesToPdf(dataUrls: string[], filename: string): void {
  if (dataUrls.length === 0) return;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  dataUrls.forEach((dataUrl, index) => {
    if (index > 0) pdf.addPage();
    pdf.addImage(dataUrl, 'PNG', 0, 0, A4_WIDTH, A4_HEIGHT, undefined, 'FAST');
  });

  const safeName = filename.replace(/[^\w\-áéíóúüñÁÉÍÓÚÜÑ ]+/gi, '_').trim() || 'carta';
  pdf.save(`${safeName}.pdf`);
}

/** @deprecated usa exportPagesToPdf */
export function exportCanvasToPdf(dataUrl: string, filename: string): void {
  exportPagesToPdf([dataUrl], filename);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
