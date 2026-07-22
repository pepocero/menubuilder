/** Fuentes disponibles en el editor (Google Fonts + fuentes locales). */
export interface EditorFontOption {
  label: string;
  value: string;
  /** Google Fonts family param, ej. "Poppins:wght@400;600;700" */
  google?: string;
  /** Ruta local @font-face (requiere archivo en public/fonts/) */
  local?: boolean;
}

export const EDITOR_FONTS: EditorFontOption[] = [
  { label: 'Poppins', value: 'Poppins', google: 'Poppins:wght@300;400;500;600;700' },
  { label: 'Another Shabby', value: 'Another Shabby', local: true },
  { label: 'Qwitcher Grypen', value: 'Qwitcher Grypen', google: 'Qwitcher+Grypen:wght@400;700' },
  { label: 'Smooch', value: 'Smooch', google: 'Smooch' },
  { label: 'Allura', value: 'Allura', google: 'Allura' },
  { label: 'Satisfy', value: 'Satisfy', google: 'Satisfy' },
  { label: 'Rubik Distressed', value: 'Rubik Distressed', google: 'Rubik+Distressed' },
  { label: 'Rubik Dirt', value: 'Rubik Dirt', google: 'Rubik+Dirt' },
  { label: 'Rock Salt', value: 'Rock Salt', google: 'Rock+Salt' },
  { label: 'Homemade Apple', value: 'Homemade Apple', google: 'Homemade+Apple' },
  { label: 'Walter Turncoat', value: 'Walter Turncoat', google: 'Walter+Turncoat' },
  { label: 'Covered By Your Grace', value: 'Covered By Your Grace', google: 'Covered+By+Your+Grace' },
  { label: 'Playfair Display', value: 'Playfair Display', google: 'Playfair+Display:wght@400;700' },
  { label: 'Montserrat', value: 'Montserrat', google: 'Montserrat:wght@400;500;600;700' },
  { label: 'Roboto', value: 'Roboto', google: 'Roboto:wght@300;400;500;700' },
  { label: 'Open Sans', value: 'Open Sans', google: 'Open+Sans:wght@400;600;700' },
  { label: 'Lato', value: 'Lato', google: 'Lato:wght@400;700' },
  { label: 'Oswald', value: 'Oswald', google: 'Oswald:wght@400;500;600;700' },
  { label: 'Raleway', value: 'Raleway', google: 'Raleway:wght@400;600;700' },
  { label: 'Merriweather', value: 'Merriweather', google: 'Merriweather:wght@400;700' },
  { label: 'Lora', value: 'Lora', google: 'Lora:wght@400;600;700' },
  { label: 'DM Sans', value: 'DM Sans', google: 'DM+Sans:wght@400;500;600;700' },
  { label: 'Fraunces', value: 'Fraunces', google: 'Fraunces:wght@400;600;700' },
  { label: 'Caveat', value: 'Caveat', google: 'Caveat:wght@400;600;700' },
  { label: 'Pacifico', value: 'Pacifico', google: 'Pacifico' },
  { label: 'Dancing Script', value: 'Dancing Script', google: 'Dancing+Script:wght@400;700' },
  { label: 'Great Vibes', value: 'Great Vibes', google: 'Great+Vibes' },
  { label: 'Bebas Neue', value: 'Bebas Neue', google: 'Bebas+Neue' },
  { label: 'Anton', value: 'Anton', google: 'Anton' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Verdana', value: 'Verdana' },
  { label: 'Courier New', value: 'Courier New' },
];

const loadedGoogleFamilies = new Set<string>();

/** Carga dinámicamente familias de Google Fonts usadas en el editor. */
export function ensureEditorFontLoaded(fontFamily: string): void {
  const option = EDITOR_FONTS.find((f) => f.value === fontFamily);
  if (!option?.google || loadedGoogleFamilies.has(option.google)) return;

  loadedGoogleFamilies.add(option.google);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${option.google}&display=swap`;
  document.head.appendChild(link);
}

/** Precarga las fuentes más usadas al abrir el editor. */
export function preloadCommonEditorFonts(): void {
  for (const font of [
    'Poppins',
    'Playfair Display',
    'Another Shabby',
    'Qwitcher Grypen',
    'Smooch',
    'Allura',
    'Satisfy',
    'Caveat',
  ]) {
    ensureEditorFontLoaded(font);
  }
}

export function buildGoogleFontsStylesheetUrl(): string {
  const families = EDITOR_FONTS.filter((f) => f.google).map((f) => `family=${f.google}`);
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}
