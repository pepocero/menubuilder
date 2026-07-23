function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

type EyeDropperResult = { sRGBHex: string };

type EyeDropperCtor = new () => { open: () => Promise<EyeDropperResult> };

/** API nativa del navegador (Chromium). */
export function supportsNativeEyeDropper(): boolean {
  return typeof window !== 'undefined' && 'EyeDropper' in window;
}

export async function pickColorWithEyeDropper(): Promise<string | null> {
  if (!supportsNativeEyeDropper()) return null;
  try {
    const EyeDropper = (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper;
    const result = await new EyeDropper().open();
    const hex = result.sRGBHex?.trim();
    return hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : null;
  } catch {
    // Usuario canceló o el navegador rechazó.
    return null;
  }
}

/**
 * Muestrea un píxel del canvas Fabric (coordenadas CSS del lowerCanvas).
 */
export function sampleColorFromFabricCanvas(
  canvas: { lowerCanvasEl?: HTMLCanvasElement | null },
  clientX: number,
  clientY: number,
): string | null {
  const el = canvas.lowerCanvasEl;
  if (!el) return null;
  const ctx = el.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const x = Math.floor(((clientX - rect.left) / rect.width) * el.width);
  const y = Math.floor(((clientY - rect.top) / rect.height) * el.height);
  if (x < 0 || y < 0 || x >= el.width || y >= el.height) return null;

  try {
    const data = ctx.getImageData(x, y, 1, 1).data;
    return rgbToHex(data[0], data[1], data[2]);
  } catch {
    // Canvas «tainted» por CORS: no se puede leer.
    return null;
  }
}
