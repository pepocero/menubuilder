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
  | 'spacer';

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
}

export interface MobileComponentBase {
  id: string;
  type: MobileComponentType;
  animation?: MobileAnimationConfig;
  typography?: MobileTypographyConfig;
  effect?: MobileEffectConfig;
}

export interface MobileSectionComponent extends MobileComponentBase {
  type: 'section';
  title: string;
  backgroundColor: string;
  padding: number;
  action?: MobileInteractionAction;
}

export interface MobileHeadingComponent extends MobileComponentBase {
  type: 'heading';
  text: string;
}

export interface MobileTextComponent extends MobileComponentBase {
  type: 'text';
  text: string;
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

export type MobileComponent =
  | MobileSectionComponent
  | MobileHeadingComponent
  | MobileTextComponent
  | MobileImageComponent
  | MobileMenuItemComponent
  | MobileButtonComponent
  | MobileDividerComponent
  | MobileSpacerComponent;

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
