import type { MenuDocument } from '@shared/menu-document/types';
import {
  canvasDataToMenuDocument,
  importJsonToCanvasData,
  serializeMenuDocument,
} from '@shared/menu-document/converter';
import { parseMobileMenuDocument, type MobileMenuDocument } from '@shared/mobile-menu';
import type { CanvasData } from '@/types/canvas';
import { normalizeCanvasData } from '@/types/canvas';
import { jsPDF } from 'jspdf';
import { A4_HEIGHT, A4_WIDTH } from '@/types/canvas';

/** Descarga el MenuDocument v1 como menu.json */
export function exportMenuDocumentJson(data: CanvasData, filename: string, title?: string): void {
  const doc = canvasDataToMenuDocument(data, { title });
  if (!doc) return;

  const json = serializeMenuDocument(doc);
  downloadJsonFile(json, filename);
}

function downloadJsonFile(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = filename.replace(/[^\w\-áéíóúüñÁÉÍÓÚÜÑ ]+/gi, '_').trim() || 'menu';
  a.download = `${safeName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Descarga la carta móvil como JSON (copia de seguridad / traslado). */
export function exportMobileMenuDocumentJson(
  document: MobileMenuDocument,
  filename: string,
  title?: string,
): void {
  const payload = {
    kind: 'paper-to-menu-mobile',
    title: title?.trim() || undefined,
    document,
  };
  downloadJsonFile(`${JSON.stringify(payload, null, 2)}\n`, filename);
}

export function buildMenuDocumentFromCanvas(
  data: CanvasData,
  title?: string,
): MenuDocument | null {
  return canvasDataToMenuDocument(data, { title });
}

export type ParsedMenuImport =
  | { kind: 'canvas'; canvas: CanvasData; title?: string }
  | { kind: 'mobile'; document: MobileMenuDocument; title?: string };

function canvasTitleFromRaw(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const meta = obj.meta;
  if (meta && typeof meta === 'object') {
    const metaTitle = (meta as { title?: unknown }).title;
    if (typeof metaTitle === 'string' && metaTitle.trim()) return metaTitle.trim();
  }
  if (typeof obj.title === 'string' && obj.title.trim()) return obj.title.trim();
  return undefined;
}

function parseExportedMobileMenu(raw: unknown): { document: MobileMenuDocument; title?: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (obj.kind === 'paper-to-menu-mobile') {
    const document = parseMobileMenuDocument(obj.document);
    if (!document) return null;
    const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : undefined;
    return { document, title };
  }
  const document = parseMobileMenuDocument(raw);
  if (!document) return null;
  return { document };
}

/** Lee un .json de carta clásica (lienzo). Rechaza JSON de carta móvil. */
export async function parseMenuJsonFile(file: File): Promise<CanvasData> {
  const parsed = await parseMenuImportFile(file);
  if (parsed.kind !== 'canvas') {
    throw new Error(
      'Este archivo es una carta móvil. Impórtalo desde Mis menús, no desde el editor clásico.',
    );
  }
  return parsed.canvas;
}

/** Lee un .json exportado: carta clásica o carta móvil. */
export async function parseMenuImportFile(file: File): Promise<ParsedMenuImport> {
  const text = await file.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido');
  }

  const mobile = parseExportedMobileMenu(raw);
  if (mobile) {
    return { kind: 'mobile', document: mobile.document, title: mobile.title };
  }

  const imported = importJsonToCanvasData(raw);
  if (!imported) {
    throw new Error(
      'JSON no reconocido. Usa un menu.json exportado desde Paper To Menu o un documento de lienzo válido.',
    );
  }

  return { kind: 'canvas', canvas: normalizeCanvasData(imported), title: canvasTitleFromRaw(raw) };
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
