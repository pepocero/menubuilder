/**
 * Márgenes relativos de la zona segura en el editor.
 * Guía para títulos/precios: en la carta pública móvil, el chrome del
 * navegador y ratios distintos pueden acercar el contenido a los bordes.
 */
export const SAFE_ZONE_INSET = {
  top: 0.06,
  right: 0.05,
  bottom: 0.1,
  left: 0.05,
} as const;

export function safeZoneInsetCss(): {
  top: string;
  right: string;
  bottom: string;
  left: string;
} {
  return {
    top: `${SAFE_ZONE_INSET.top * 100}%`,
    right: `${SAFE_ZONE_INSET.right * 100}%`,
    bottom: `${SAFE_ZONE_INSET.bottom * 100}%`,
    left: `${SAFE_ZONE_INSET.left * 100}%`,
  };
}
