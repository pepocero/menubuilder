import type { MenuPage } from '@/types/canvas';
import { A4_HEIGHT, A4_WIDTH } from '@/types/canvas';

/** 1 cm en puntos PDF (72 dpi), mismo sistema que A4 = 595×842. */
export const CM_TO_PT = 72 / 2.54;
export const PT_TO_CM = 2.54 / 72;

export const PAGE_SIZE_MIN_CM = 5;
export const PAGE_SIZE_MAX_CM = 100;

export interface PageSizePreset {
  id: string;
  label: string;
  /** Si falta, es «Personalizado». */
  widthCm?: number;
  heightCm?: number;
}

export const PAGE_SIZE_PRESETS: PageSizePreset[] = [
  { id: 'a4', label: 'A4 vertical (21 × 29,7 cm)', widthCm: 21, heightCm: 29.7 },
  { id: 'a4-landscape', label: 'A4 horizontal (29,7 × 21 cm)', widthCm: 29.7, heightCm: 21 },
  { id: 'a5', label: 'A5 (14,8 × 21 cm)', widthCm: 14.8, heightCm: 21 },
  { id: 'letter', label: 'Letter (21,6 × 27,9 cm)', widthCm: 21.59, heightCm: 27.94 },
  { id: 'square', label: 'Cuadrado (20 × 20 cm)', widthCm: 20, heightCm: 20 },
  { id: 'mobile', label: 'Móvil 9:16 (9 × 16 cm)', widthCm: 9, heightCm: 16 },
  { id: 'story', label: 'Historia / Story (10,8 × 19,2 cm)', widthCm: 10.8, heightCm: 19.2 },
  { id: 'tablet', label: 'Tablet horizontal (25 × 18 cm)', widthCm: 25, heightCm: 18 },
  { id: 'custom', label: 'Personalizado (cm)' },
];

export function cmToPt(cm: number): number {
  return Math.round(cm * CM_TO_PT);
}

export function ptToCm(pt: number): number {
  return Math.round(pt * PT_TO_CM * 100) / 100;
}

export function clampPageSizeCm(cm: number): number {
  if (!Number.isFinite(cm)) return PAGE_SIZE_MIN_CM;
  return Math.max(PAGE_SIZE_MIN_CM, Math.min(PAGE_SIZE_MAX_CM, cm));
}

export function getPageSize(page: Pick<MenuPage, 'width' | 'height'> | null | undefined): {
  width: number;
  height: number;
} {
  const width =
    typeof page?.width === 'number' && page.width > 0 ? Math.round(page.width) : A4_WIDTH;
  const height =
    typeof page?.height === 'number' && page.height > 0 ? Math.round(page.height) : A4_HEIGHT;
  return { width, height };
}

export function matchPageSizePreset(widthPt: number, heightPt: number): string {
  const wCm = ptToCm(widthPt);
  const hCm = ptToCm(heightPt);
  for (const preset of PAGE_SIZE_PRESETS) {
    if (preset.id === 'custom' || preset.widthCm == null || preset.heightCm == null) continue;
    if (Math.abs(preset.widthCm - wCm) < 0.15 && Math.abs(preset.heightCm - hCm) < 0.15) {
      return preset.id;
    }
  }
  return 'custom';
}

export function sizeFromPresetId(presetId: string): { width: number; height: number } | null {
  const preset = PAGE_SIZE_PRESETS.find((p) => p.id === presetId);
  if (!preset || preset.widthCm == null || preset.heightCm == null) return null;
  return {
    width: cmToPt(preset.widthCm),
    height: cmToPt(preset.heightCm),
  };
}
