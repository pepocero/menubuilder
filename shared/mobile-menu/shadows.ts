/** Intensidad de sombra móvil (1–10). Misma fórmula para texto y flecha de acordeón. */

export function resolveMobileShadowIntensity(intensity?: number): number {
  return Math.max(1, Math.min(10, intensity ?? 4));
}

export function mobileTextShadowCss(intensity?: number): string {
  const i = resolveMobileShadowIntensity(intensity);
  const y = Math.max(1, Math.round(i * 0.45));
  const blur = Math.max(2, Math.round(i * 1.2));
  const alpha = Math.min(0.9, 0.2 + i * 0.07);
  return `0 ${y}px ${blur}px rgba(0, 0, 0, ${alpha.toFixed(2)})`;
}

/** Equivalente visual para SVG / iconos (p. ej. flecha del acordeón). */
export function mobileDropShadowFilter(intensity?: number): string {
  return `drop-shadow(${mobileTextShadowCss(intensity)})`;
}
