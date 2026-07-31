export const MOBILE_MENU_VERSION = 1 as const;

export type MobileMenuVersion = typeof MOBILE_MENU_VERSION;

export type DevicePresetId =
  | 'iphone_13_14'
  | 'iphone_15_pro'
  | 'iphone_15_pro_max'
  | 'samsung_s23'
  | 'samsung_s24'
  | 'samsung_a54'
  | 'xiaomi_13'
  | 'xiaomi_13_pro'
  | 'xiaomi_redmi_note_13';

export interface MobileDevicePreset {
  id: DevicePresetId;
  label: string;
  width: number;
  height: number;
}

export interface MobileViewport {
  width: number;
  height: number;
  presetId: DevicePresetId;
}

export type MobileComponentType =
  | 'section'
  | 'heading'
  | 'text'
  | 'image'
  | 'menuItem'
  | 'button'
  | 'divider'
  | 'spacer'
  | 'accordion';

export type MobileAnimationPreset = 'none' | 'reveal' | 'tap' | 'parallax' | 'lottie';
export type MobileAnimationTrigger = 'on_view' | 'on_load' | 'on_tap';

export interface MobileAnimationConfig {
  preset: MobileAnimationPreset;
  trigger: MobileAnimationTrigger;
  durationMs: number;
  delayMs: number;
  intensity: number;
}

export type MobileEffectType =
  | 'none'
  | 'pulse'
  | 'shake'
  | 'bounce'
  | 'glow'
  | 'shimmer'
  | 'heartbeat'
  | 'swing'
  | 'rubberBand'
  | 'flash';

export type MobileEffectRepeat = 'once' | 'loop';
export type MobileEffectTrigger = 'on_view' | 'on_load' | 'always';

export interface MobileEffectConfig {
  type: MobileEffectType;
  repeat: MobileEffectRepeat;
  trigger: MobileEffectTrigger;
  durationMs: number;
  delayMs: number;
}

export interface MobileTypographyConfig {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline' | 'line-through';
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;
  letterSpacing: number;
  color: string;
  /** Sombra de texto opcional (p. ej. título de sección sobre foto). */
  textShadow?: boolean;
  /** Intensidad 1–10. Solo aplica si textShadow es true. */
  textShadowIntensity?: number;
}

export interface MobileComponentBase {
  id: string;
  type: MobileComponentType;
  /**
   * Si true, el componente no se muestra en la URL pública.
   * En el editor siempre se puede ver y editar. Por defecto: visible.
   */
  hidden?: boolean;
  animation?: MobileAnimationConfig;
  typography?: MobileTypographyConfig;
  effect?: MobileEffectConfig;
}

export interface MobileSectionComponent extends MobileComponentBase {
  type: 'section';
  title: string;
  backgroundColor: string;
  padding: number;
  /**
   * Altura de la sección. Por defecto: `s` (Pequeño).
   * `auto` = según el contenido.
   */
  size?: MobileSectionSize;
  /**
   * Línea de borde. Por defecto: `thin` (Fino).
   */
  borderLine?: MobileSectionBorderLine;
  /**
   * Redondeado de esquinas. Por defecto: `md` (Redondeado).
   */
  borderRound?: MobileSectionBorderRound;
  /** Imagen de fondo opcional de la sección. */
  backgroundImage?: {
    src: string;
    align: 'left' | 'center' | 'right';
    /** Si es true, la imagen cubre todo el componente. */
    stretch: boolean;
  };
  /**
   * Margen izquierdo del título (px). Puede ser negativo.
   * Útil para desplazar el texto cuando hay imagen alineada a la izquierda.
   */
  textOffsetX?: number;
  /**
   * Desplazamiento vertical del título (px). Negativo = arriba, positivo = abajo.
   */
  textOffsetY?: number;
  action?: MobileInteractionAction;
}

/** Tamaños de sección móvil. Por defecto en nuevas secciones: `s` (Pequeño). */
export type MobileSectionSize = 'auto' | 's' | 'm' | 'l' | 'xl';

export const MOBILE_SECTION_SIZE_OPTIONS: ReadonlyArray<{
  id: MobileSectionSize;
  label: string;
  /** min-height en px; 0 = sin mínimo (automático). */
  minHeight: number;
}> = [
  { id: 'auto', label: 'Automático', minHeight: 0 },
  { id: 's', label: 'Pequeño', minHeight: 96 },
  { id: 'm', label: 'Mediano', minHeight: 160 },
  { id: 'l', label: 'Grande', minHeight: 240 },
  { id: 'xl', label: 'Muy grande', minHeight: 360 },
];

export function resolveSectionMinHeight(size?: MobileSectionSize): number {
  const match = MOBILE_SECTION_SIZE_OPTIONS.find((o) => o.id === (size ?? 's'));
  return match?.minHeight ?? 96;
}

/** Línea del borde de sección. */
export type MobileSectionBorderLine = 'none' | 'thin' | 'medium' | 'thick' | 'dashed';

export const MOBILE_SECTION_BORDER_LINE_OPTIONS: ReadonlyArray<{
  id: MobileSectionBorderLine;
  label: string;
  style: 'none' | 'solid' | 'dashed';
  width: number;
  color: string;
}> = [
  { id: 'none', label: 'Sin borde', style: 'none', width: 0, color: 'transparent' },
  { id: 'thin', label: 'Fino', style: 'solid', width: 1, color: '#d1d5db' },
  { id: 'medium', label: 'Medio', style: 'solid', width: 2, color: '#d1d5db' },
  { id: 'thick', label: 'Grueso', style: 'solid', width: 3, color: '#9ca3af' },
  { id: 'dashed', label: 'Discontinuo', style: 'dashed', width: 2, color: '#9ca3af' },
];

/** Redondeado de esquinas de sección. */
export type MobileSectionBorderRound = 'none' | 'sm' | 'md' | 'lg' | 'xl';

export const MOBILE_SECTION_BORDER_ROUND_OPTIONS: ReadonlyArray<{
  id: MobileSectionBorderRound;
  label: string;
  radius: number;
}> = [
  { id: 'none', label: 'Sin borde redondeado', radius: 0 },
  { id: 'sm', label: 'Suave', radius: 8 },
  { id: 'md', label: 'Redondeado', radius: 16 },
  { id: 'lg', label: 'Más redondeado', radius: 28 },
  { id: 'xl', label: 'Muy redondeado', radius: 40 },
];

export function resolveSectionBorderStyle(
  borderLine?: MobileSectionBorderLine,
  borderRound?: MobileSectionBorderRound,
): { border?: string; borderRadius?: string } {
  const line =
    MOBILE_SECTION_BORDER_LINE_OPTIONS.find((o) => o.id === (borderLine ?? 'thin')) ??
    MOBILE_SECTION_BORDER_LINE_OPTIONS.find((o) => o.id === 'thin')!;
  const round =
    MOBILE_SECTION_BORDER_ROUND_OPTIONS.find((o) => o.id === (borderRound ?? 'md')) ??
    MOBILE_SECTION_BORDER_ROUND_OPTIONS.find((o) => o.id === 'md')!;

  const style: { border?: string; borderRadius?: string } = {};
  if (line.style !== 'none' && line.width > 0) {
    style.border = `${line.width}px ${line.style} ${line.color}`;
  }
  if (round.radius > 0) {
    style.borderRadius = `${round.radius}px`;
  }
  return style;
}

/** Compatibilidad con el antiguo campo único `border`. */
export function migrateLegacySectionBorder(legacy: string | undefined): {
  borderLine: MobileSectionBorderLine;
  borderRound: MobileSectionBorderRound;
} {
  switch (legacy) {
    case 'none':
      return { borderLine: 'none', borderRound: 'none' };
    case 'thin':
      return { borderLine: 'thin', borderRound: 'none' };
    case 'medium':
      return { borderLine: 'medium', borderRound: 'sm' };
    case 'thick':
      return { borderLine: 'thick', borderRound: 'sm' };
    case 'extraRounded':
      return { borderLine: 'thin', borderRound: 'lg' };
    case 'dashed':
      return { borderLine: 'dashed', borderRound: 'sm' };
    case 'rounded':
    default:
      return { borderLine: 'thin', borderRound: 'md' };
  }
}

export interface MobileHeadingComponent extends MobileComponentBase {
  type: 'heading';
  text: string;
}

export interface MobileTextComponent extends MobileComponentBase {
  type: 'text';
  text: string;
  /** Lista: ninguna, viñetas o numerada (una línea = un ítem). */
  listStyle: 'none' | 'bullet' | 'number';
  /** Sangría izquierda en px (0–96). */
  indentPx: number;
}

export interface MobileImageComponent extends MobileComponentBase {
  type: 'image';
  src: string;
  alt: string;
  radius: number;
}

export interface MobileMenuItemComponent extends MobileComponentBase {
  type: 'menuItem';
  title: string;
  description: string;
  price: string;
  ingredients: string;
  /** Alérgenos: uno por línea (también admite comas). */
  allergens: string;
  menuImage?: {
    src: string;
    alt: string;
    position: 'left' | 'right';
    width: number;
    radius: number;
  };
  menuTypography?: {
    title?: MobileTypographyConfig;
    description?: MobileTypographyConfig;
    price?: MobileTypographyConfig;
    ingredients?: MobileTypographyConfig;
  };
}

export interface MobileButtonComponent extends MobileComponentBase {
  type: 'button';
  label: string;
  href: string;
  backgroundColor: string;
  textColor: string;
  action?: MobileInteractionAction;
}

export type MobileInteractionActionType = 'none' | 'url' | 'section' | 'modal';

export interface MobileModalPayload {
  title: string;
  body: string;
  closeLabel: string;
}

export interface MobileInteractionAction {
  type: MobileInteractionActionType;
  url?: string;
  sectionId?: string;
  modal?: MobileModalPayload;
}

export interface MobileDividerComponent extends MobileComponentBase {
  type: 'divider';
  color: string;
  thickness: number;
}

export interface MobileSpacerComponent extends MobileComponentBase {
  type: 'spacer';
  height: number;
}

/** Animación de la flecha en reposo (colapsado). Al abrir/cerrar siempre gira 180°. */
export type MobileAccordionChevronAnimation =
  | 'none'
  | 'rotate' // legado: equivale a `none` (sin animación en reposo)
  | 'bounce'
  | 'flip'
  | 'spin'
  | 'pulse';

/**
 * Contenedor acordeón: el primer hijo es la cabecera (clic para expandir/contraer);
 * el resto es el cuerpo colapsable. No admite acordeones anidados.
 */
export interface MobileAccordionComponent extends MobileComponentBase {
  type: 'accordion';
  children: MobileAccordionChild[];
  /** Si true, arranca expandido. Por defecto: false (colapsado). */
  defaultOpen?: boolean;
  /** Si true, muestra flecha de expansión. Por defecto: true. */
  showChevron?: boolean;
  /** Color de la flecha (CSS). Por defecto: `#64748b`. */
  chevronColor?: string;
  /** Grosor de línea de la flecha (1–8). Por defecto: 2. */
  chevronThickness?: number;
  /** Animación de la flecha en reposo (colapsado). Al abrir siempre gira 180°. Por defecto: `none`. */
  chevronAnimation?: MobileAccordionChevronAnimation;
}

/** Hijos válidos de un acordeón (cualquier componente excepto otro acordeón). */
export type MobileAccordionChild = Exclude<MobileComponent, MobileAccordionComponent>;

export type MobileComponent =
  | MobileSectionComponent
  | MobileHeadingComponent
  | MobileTextComponent
  | MobileImageComponent
  | MobileMenuItemComponent
  | MobileButtonComponent
  | MobileDividerComponent
  | MobileSpacerComponent
  | MobileAccordionComponent;

export interface MobileTheme {
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  fontFamily: string;
}

export interface MobileMenuDocument {
  version: MobileMenuVersion;
  viewport: MobileViewport;
  theme: MobileTheme;
  components: MobileComponent[];
}
