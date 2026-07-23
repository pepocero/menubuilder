import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';

/** Tamaño de pantalla / miniatura. */
export const QR_PREVIEW_SIZE = 220;

/**
 * Tamaño para descarga e impresión.
 * PNG/SVG con módulos grandes escanean bien en mesa/escaparate.
 */
export const QR_DOWNLOAD_SIZE = 1024;

/** Corrección de errores alta: más robusto si el QR se ensucia o se imprime pequeño. */
export const QR_ERROR_LEVEL = 'H' as const;

function triggerDownload(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
}

/** Descarga PNG de alta resolución (recomendado para imprimir). */
export async function downloadQrPng(value: string, filenameBase: string): Promise<void> {
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-9999px;top:0;width:0;height:0;overflow:hidden;pointer-events:none';
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    await new Promise<void>((resolve, reject) => {
      root.render(
        createElement(QRCodeCanvas, {
          value,
          size: QR_DOWNLOAD_SIZE,
          level: QR_ERROR_LEVEL,
          includeMargin: true,
          id: 'menubuilder-qr-download-canvas',
        }),
      );
      // Esperar un frame a que el canvas pinte.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const canvas = document.getElementById(
            'menubuilder-qr-download-canvas',
          ) as HTMLCanvasElement | null;
          if (!canvas) {
            reject(new Error('No se pudo generar el QR'));
            return;
          }
          try {
            const url = canvas.toDataURL('image/png');
            triggerDownload(url, `${filenameBase}.png`);
            resolve();
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
      });
    });
  } finally {
    root.unmount();
    host.remove();
  }
}

/** Descarga SVG vectorial grande (escala bien; algunos programas usan el size intrínseco). */
export async function downloadQrSvg(value: string, filenameBase: string): Promise<void> {
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-9999px;top:0;width:0;height:0;overflow:hidden;pointer-events:none';
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    await new Promise<void>((resolve, reject) => {
      root.render(
        createElement(QRCodeSVG, {
          value,
          size: QR_DOWNLOAD_SIZE,
          level: QR_ERROR_LEVEL,
          includeMargin: true,
          id: 'menubuilder-qr-download-svg',
        }),
      );
      requestAnimationFrame(() => {
        const svg = document.getElementById('menubuilder-qr-download-svg');
        if (!svg) {
          reject(new Error('No se pudo generar el QR'));
          return;
        }
        const source = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        triggerDownload(url, `${filenameBase}.svg`);
        URL.revokeObjectURL(url);
        resolve();
      });
    });
  } finally {
    root.unmount();
    host.remove();
  }
}
