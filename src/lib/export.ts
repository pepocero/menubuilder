import { jsPDF } from 'jspdf';
import { A4_HEIGHT, A4_WIDTH } from '@/types/canvas';

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
