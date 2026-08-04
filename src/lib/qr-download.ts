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
  const canvas = await renderOffscreenQrCanvas(value);
  try {
    const url = canvas.toDataURL('image/png');
    triggerDownload(url, `${filenameBase}.png`);
  } finally {
    canvas.remove();
  }
}

/** Descarga SVG vectorial grande (1024×1024 intrínsecos). */
export async function downloadQrSvg(value: string, filenameBase: string): Promise<void> {
  const svg = await renderOffscreenQrSvg(value);
  try {
    // Asegura tamaño intrínseco alto (algunos visores usan solo width/height del root).
    svg.setAttribute('width', String(QR_DOWNLOAD_SIZE));
    svg.setAttribute('height', String(QR_DOWNLOAD_SIZE));
    if (!svg.getAttribute('viewBox')) {
      svg.setAttribute('viewBox', `0 0 ${QR_DOWNLOAD_SIZE} ${QR_DOWNLOAD_SIZE}`);
    }
    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${filenameBase}.svg`);
    URL.revokeObjectURL(url);
  } finally {
    svg.remove();
  }
}

function waitFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => {
      if (left <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(left - 1));
    };
    step(n);
  });
}

async function renderOffscreenQrCanvas(value: string): Promise<HTMLCanvasElement> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:1024px;height:1024px;overflow:hidden;pointer-events:none;opacity:0;';
  document.body.appendChild(host);

  const root = createRoot(host);
  const canvasId = `papertomenu-qr-png-${crypto.randomUUID()}`;
  root.render(
    createElement(QRCodeCanvas, {
      value,
      size: QR_DOWNLOAD_SIZE,
      level: QR_ERROR_LEVEL,
      includeMargin: true,
      id: canvasId,
    }),
  );

  await waitFrames(3);
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas || canvas.width < QR_DOWNLOAD_SIZE * 0.5) {
    root.unmount();
    host.remove();
    throw new Error('No se pudo generar el QR PNG');
  }

  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  if (!ctx) {
    root.unmount();
    host.remove();
    throw new Error('No se pudo generar el QR PNG');
  }
  ctx.drawImage(canvas, 0, 0);

  root.unmount();
  host.remove();
  return out;
}

async function renderOffscreenQrSvg(value: string): Promise<SVGSVGElement> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:1024px;height:1024px;overflow:hidden;pointer-events:none;opacity:0;';
  document.body.appendChild(host);

  const root = createRoot(host);
  const svgId = `papertomenu-qr-svg-${crypto.randomUUID()}`;
  root.render(
    createElement(QRCodeSVG, {
      value,
      size: QR_DOWNLOAD_SIZE,
      level: QR_ERROR_LEVEL,
      includeMargin: true,
      id: svgId,
    }),
  );

  await waitFrames(3);
  const svg = document.getElementById(svgId);
  if (!(svg instanceof SVGSVGElement)) {
    root.unmount();
    host.remove();
    throw new Error('No se pudo generar el QR SVG');
  }

  // Clonar antes de desmontar React (el nodo original se destruye al unmount).
  const clone = svg.cloneNode(true) as SVGSVGElement;
  root.unmount();
  host.remove();
  return clone;
}
