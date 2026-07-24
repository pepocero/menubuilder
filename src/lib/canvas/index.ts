export { ensureFontsLoaded, extractFontFamiliesFromPage } from '@/lib/canvas/fonts';
export { CUSTOM_TEXT_PROPS, DEFAULT_TEXT_LINE_HEIGHT } from '@/lib/canvas/text-props';
export {
  renderDesign,
  hydrateDesign,
  fitCanvasToContainer,
  recalculateTextboxHeights,
  designCanvasToDataUrl,
  disposeDesignCanvas,
  type DesignCanvas,
  type RenderDesignOptions,
} from '@/lib/canvas/render-design';
