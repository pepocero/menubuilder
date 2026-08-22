import { MOBILE_DEVICE_PRESETS, createDefaultMobileMenuDocument } from './defaults';
import {
  MOBILE_MENU_VERSION,
  migrateLegacySectionBorder,
  type MobileAccordionChevronAnimation,
  type MobileAccordionChevronDirection,
  type MobileComponent,
  type MobileMenuDocument,
  type MobileSectionBorderLine,
  type MobileSectionBorderRound,
} from './types';

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

const ACCORDION_CHEVRON_ANIMATIONS: readonly MobileAccordionChevronAnimation[] = [
  'rotate',
  'bounce',
  'flip',
  'spin',
  'pulse',
  'none',
];

const ACCORDION_CHEVRON_DIRECTIONS: readonly MobileAccordionChevronDirection[] = [
  'down',
  'right',
];

function parseChevronAnimation(value: unknown): MobileAccordionChevronAnimation | undefined {
  if (!isString(value)) return undefined;
  return (ACCORDION_CHEVRON_ANIMATIONS as readonly string[]).includes(value)
    ? (value as MobileAccordionChevronAnimation)
    : undefined;
}

function parseChevronDirection(value: unknown): MobileAccordionChevronDirection | undefined {
  if (!isString(value)) return undefined;
  return (ACCORDION_CHEVRON_DIRECTIONS as readonly string[]).includes(value)
    ? (value as MobileAccordionChevronDirection)
    : undefined;
}

function parseAnimation(value: unknown): MobileComponent['animation'] {
  if (!isObject(value)) return undefined;
  const preset = value.preset;
  const trigger = value.trigger;
  if (
    (preset !== 'none' && preset !== 'reveal' && preset !== 'tap' && preset !== 'parallax' && preset !== 'lottie') ||
    (trigger !== 'on_view' && trigger !== 'on_load' && trigger !== 'on_tap')
  ) {
    return undefined;
  }
  if (!isNumber(value.durationMs) || !isNumber(value.delayMs) || !isNumber(value.intensity)) {
    return undefined;
  }
  return {
    preset,
    trigger,
    durationMs: Math.max(0, Math.min(5000, Math.round(value.durationMs))),
    delayMs: Math.max(0, Math.min(5000, Math.round(value.delayMs))),
    intensity: Math.max(0.1, Math.min(3, value.intensity)),
  };
}

const VALID_EFFECT_TYPES = new Set(['none','pulse','shake','bounce','glow','shimmer','heartbeat','swing','rubberBand','flash']);
const VALID_EFFECT_REPEATS = new Set(['once','loop']);
const VALID_EFFECT_TRIGGERS = new Set(['on_view','on_load','always']);

function parseEffect(value: unknown): MobileComponent['effect'] {
  if (!isObject(value)) return undefined;
  const type = value.type;
  const repeat = value.repeat;
  const trigger = value.trigger;
  if (!isString(type) || !VALID_EFFECT_TYPES.has(type)) return undefined;
  if (!isString(repeat) || !VALID_EFFECT_REPEATS.has(repeat)) return undefined;
  if (!isString(trigger) || !VALID_EFFECT_TRIGGERS.has(trigger)) return undefined;
  if (!isNumber(value.durationMs) || !isNumber(value.delayMs)) return undefined;
  return {
    type: type as MobileComponent['effect'] extends undefined ? never : NonNullable<MobileComponent['effect']>['type'],
    repeat: repeat as 'once' | 'loop',
    trigger: trigger as 'on_view' | 'on_load' | 'always',
    durationMs: Math.max(100, Math.min(5000, Math.round(value.durationMs))),
    delayMs: Math.max(0, Math.min(5000, Math.round(value.delayMs))),
  };
}

function parseTypography(value: unknown): MobileComponent['typography'] {
  if (!isObject(value)) return undefined;
  const fontFamily = value.fontFamily;
  const fontStyle = value.fontStyle;
  const textDecoration = value.textDecoration;
  const textTransform = value.textTransform;
  const textAlign = value.textAlign;
  if (
    !isString(fontFamily) ||
    !isNumber(value.fontSize) ||
    !isNumber(value.fontWeight) ||
    !isNumber(value.lineHeight) ||
    !isNumber(value.letterSpacing) ||
    !isString(value.color) ||
    (fontStyle !== 'normal' && fontStyle !== 'italic') ||
    (textDecoration !== 'none' && textDecoration !== 'underline' && textDecoration !== 'line-through') ||
    (textTransform !== 'none' &&
      textTransform !== 'uppercase' &&
      textTransform !== 'lowercase' &&
      textTransform !== 'capitalize') ||
    (textAlign !== 'left' && textAlign !== 'center' && textAlign !== 'right')
  ) {
    return undefined;
  }
  const textShadow = value.textShadow === true;
  const textShadowIntensity = isNumber(value.textShadowIntensity)
    ? Math.max(1, Math.min(10, Math.round(value.textShadowIntensity)))
    : undefined;
  return {
    fontFamily,
    fontSize: Math.max(8, Math.min(96, Math.round(value.fontSize))),
    fontWeight: Math.max(100, Math.min(900, Math.round(value.fontWeight))),
    fontStyle,
    textDecoration,
    textTransform,
    textAlign,
    lineHeight: Math.max(1, Math.min(3, value.lineHeight)),
    letterSpacing: Math.max(-2, Math.min(12, value.letterSpacing)),
    color: value.color,
    ...(textShadow ? { textShadow: true } : {}),
    ...(textShadow && textShadowIntensity != null ? { textShadowIntensity } : {}),
  };
}

function parseMenuTypography(value: unknown):
  | { title?: MobileComponent['typography']; description?: MobileComponent['typography']; price?: MobileComponent['typography']; ingredients?: MobileComponent['typography'] }
  | undefined {
  if (!isObject(value)) return undefined;
  const title = parseTypography(value.title);
  const description = parseTypography(value.description);
  const price = parseTypography(value.price);
  const ingredients = parseTypography(value.ingredients);
  if (!title && !description && !price && !ingredients) return undefined;
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(price ? { price } : {}),
    ...(ingredients ? { ingredients } : {}),
  };
}

function parseMenuItemImage(value: unknown): {
  src: string;
  alt: string;
  position: 'left' | 'right';
  width: number;
  radius: number;
} | undefined {
  if (!isObject(value)) return undefined;
  if (!isString(value.src) || !isString(value.alt)) return undefined;
  const position: 'left' | 'right' = value.position === 'right' ? 'right' : 'left';
  const width = isNumber(value.width) ? Math.max(56, Math.min(180, Math.round(value.width))) : 92;
  const radius = isNumber(value.radius) ? Math.max(0, Math.min(28, Math.round(value.radius))) : 10;
  return {
    src: value.src.trim().slice(0, 4096),
    alt: value.alt.trim().slice(0, 160),
    position,
    width,
    radius,
  };
}

function parseSectionBackgroundImage(value: unknown): {
  src: string;
  align: 'left' | 'center' | 'right';
  stretchMode: import('./types').MobileSectionBgStretchMode;
  stretch: boolean;
} | undefined {
  if (!isObject(value)) return undefined;
  if (!isString(value.src)) return undefined;
  const align: 'left' | 'center' | 'right' =
    value.align === 'left' || value.align === 'right' ? value.align : 'center';
  const stretchMode =
    value.stretchMode === 'none' ||
    value.stretchMode === 'cover' ||
    value.stretchMode === 'horizontal' ||
    value.stretchMode === 'vertical' ||
    value.stretchMode === 'both'
      ? value.stretchMode
      : value.stretch === false
        ? 'none'
        : 'cover';
  return {
    src: value.src.trim().slice(0, 4096),
    align,
    stretchMode,
    stretch: stretchMode !== 'none',
  };
}

function parseModalPayload(value: unknown) {
  if (!isObject(value)) return undefined;
  if (!isString(value.title) || !isString(value.body) || !isString(value.closeLabel)) return undefined;
  return {
    title: value.title.trim().slice(0, 120),
    body: value.body.trim().slice(0, 1500),
    closeLabel: (value.closeLabel.trim() || 'Cerrar').slice(0, 40),
  };
}

function parseInteractionAction(value: unknown, fallbackUrl?: string) {
  if (!isObject(value) || !isString(value.type)) {
    if (fallbackUrl) {
      return {
        type: 'url' as const,
        url: fallbackUrl,
      };
    }
    return undefined;
  }
  if (value.type === 'none') {
    return { type: 'none' as const };
  }
  if (value.type === 'url') {
    const url = isString(value.url) ? value.url : fallbackUrl;
    if (!url) return { type: 'none' as const };
    return { type: 'url' as const, url: url.trim().slice(0, 2048) };
  }
  if (value.type === 'section') {
    if (!isString(value.sectionId)) return { type: 'none' as const };
    return { type: 'section' as const, sectionId: value.sectionId };
  }
  if (value.type === 'modal') {
    const modal = parseModalPayload(value.modal);
    if (!modal) return { type: 'none' as const };
    return { type: 'modal' as const, modal };
  }
  return fallbackUrl ? { type: 'url' as const, url: fallbackUrl } : undefined;
}

function parseComponent(value: unknown): MobileComponent | null {
  if (!isObject(value) || !isString(value.id) || !isString(value.type)) return null;
  const type = value.type;
  if (type === 'section' && isString(value.title) && isString(value.backgroundColor) && isNumber(value.padding)) {
    const size =
      value.size === 'auto' ||
      value.size === 's' ||
      value.size === 'm' ||
      value.size === 'l' ||
      value.size === 'xl'
        ? value.size
        : 's';
    const hasNewBorderFields =
      value.borderLine !== undefined || value.borderRound !== undefined;
    let borderLine: MobileSectionBorderLine;
    let borderRound: MobileSectionBorderRound;
    if (hasNewBorderFields) {
      borderLine =
        value.borderLine === 'none' ||
        value.borderLine === 'thin' ||
        value.borderLine === 'medium' ||
        value.borderLine === 'thick' ||
        value.borderLine === 'dashed'
          ? value.borderLine
          : 'thin';
      borderRound =
        value.borderRound === 'none' ||
        value.borderRound === 'sm' ||
        value.borderRound === 'md' ||
        value.borderRound === 'lg' ||
        value.borderRound === 'xl'
          ? value.borderRound
          : 'md';
    } else {
      const migrated = migrateLegacySectionBorder(
        isString(value.border) ? value.border : undefined,
      );
      borderLine = migrated.borderLine;
      borderRound = migrated.borderRound;
    }
    return {
      id: value.id,
      type,
      title: value.title,
      backgroundColor: value.backgroundColor,
      padding: value.padding,
      size,
      borderLine,
      borderRound,
      backgroundImage: parseSectionBackgroundImage(value.backgroundImage),
      textOffsetX: isNumber(value.textOffsetX)
        ? Math.max(-400, Math.min(400, Math.round(value.textOffsetX)))
        : undefined,
      textOffsetY: isNumber(value.textOffsetY)
        ? Math.max(-400, Math.min(400, Math.round(value.textOffsetY)))
        : undefined,
      action: parseInteractionAction(value.action),
      animation: parseAnimation(value.animation),
      effect: parseEffect(value.effect),
      typography: parseTypography(value.typography),
    };
  }
  if (type === 'heading' && isString(value.text)) {
    const legacyColor = isString(value.color) ? value.color : '#111827';
    const legacySize = isNumber(value.fontSize) ? value.fontSize : 28;
    const legacyWeight = isNumber(value.fontWeight) ? value.fontWeight : 700;
    const legacyAlign = value.align === 'center' || value.align === 'right' ? value.align : 'left';
    return {
      id: value.id,
      type,
      text: value.text,
      animation: parseAnimation(value.animation),
      effect: parseEffect(value.effect),
      typography:
        parseTypography(value.typography) ?? {
          fontFamily: 'Inter, system-ui, Arial, sans-serif',
          fontSize: Math.max(8, Math.min(96, Math.round(legacySize))),
          fontWeight: Math.max(100, Math.min(900, Math.round(legacyWeight))),
          fontStyle: 'normal',
          textDecoration: 'none',
          textTransform: 'none',
          textAlign: legacyAlign,
          lineHeight: 1.2,
          letterSpacing: 0,
          color: legacyColor,
        },
    };
  }
  if (type === 'text' && isString(value.text)) {
    const legacyColor = isString(value.color) ? value.color : '#374151';
    const legacySize = isNumber(value.fontSize) ? value.fontSize : 16;
    const legacyAlign = value.align === 'center' || value.align === 'right' ? value.align : 'left';
    const listStyle =
      value.listStyle === 'bullet' || value.listStyle === 'number' ? value.listStyle : 'none';
    const indentPx = isNumber(value.indentPx)
      ? Math.max(0, Math.min(96, Math.round(value.indentPx)))
      : 0;
    return {
      id: value.id,
      type,
      text: value.text,
      listStyle,
      indentPx,
      animation: parseAnimation(value.animation),
      effect: parseEffect(value.effect),
      typography:
        parseTypography(value.typography) ?? {
          fontFamily: 'Inter, system-ui, Arial, sans-serif',
          fontSize: Math.max(8, Math.min(96, Math.round(legacySize))),
          fontWeight: 400,
          fontStyle: 'normal',
          textDecoration: 'none',
          textTransform: 'none',
          textAlign: legacyAlign,
          lineHeight: 1.45,
          letterSpacing: 0,
          color: legacyColor,
        },
    };
  }
  if (type === 'image' && isString(value.src) && isString(value.alt) && isNumber(value.radius)) {
    return {
      id: value.id,
      type,
      src: value.src,
      alt: value.alt,
      radius: value.radius,
      animation: parseAnimation(value.animation),
      effect: parseEffect(value.effect),
      typography: parseTypography(value.typography),
    };
  }
  if (type === 'menuItem' && isString(value.title) && isString(value.description) && isString(value.price) && isString(value.ingredients)) {
    return {
      id: value.id,
      type,
      title: value.title,
      description: value.description,
      price: value.price,
      ingredients: value.ingredients,
      allergens: isString(value.allergens) ? value.allergens : '',
      allergensAccentColor:
        isString(value.allergensAccentColor) && value.allergensAccentColor.trim()
          ? value.allergensAccentColor.trim().slice(0, 64)
          : '#b45309',
      ingredientsDisplay: value.ingredientsDisplay === 'button' ? 'button' : 'text',
      ingredientsAccentColor:
        isString(value.ingredientsAccentColor) && value.ingredientsAccentColor.trim()
          ? value.ingredientsAccentColor.trim().slice(0, 64)
          : '#4d7c0f',
      backgroundColor:
        isString(value.backgroundColor) && value.backgroundColor.trim()
          ? value.backgroundColor.trim().slice(0, 64)
          : '#ffffff',
      menuImage: parseMenuItemImage(value.menuImage),
      animation: parseAnimation(value.animation),
      effect: parseEffect(value.effect),
      typography: parseTypography(value.typography),
      menuTypography: parseMenuTypography(value.menuTypography),
    };
  }
  if (type === 'button' && isString(value.label) && isString(value.href) && isString(value.backgroundColor) && isString(value.textColor)) {
    return {
      id: value.id,
      type,
      label: value.label,
      href: value.href,
      action: parseInteractionAction(value.action, value.href),
      backgroundColor: value.backgroundColor,
      textColor: value.textColor,
      animation: parseAnimation(value.animation),
      effect: parseEffect(value.effect),
      typography: parseTypography(value.typography),
    };
  }
  if (type === 'divider' && isString(value.color) && isNumber(value.thickness)) {
    return {
      id: value.id,
      type,
      color: value.color,
      thickness: value.thickness,
      animation: parseAnimation(value.animation),
      effect: parseEffect(value.effect),
      typography: parseTypography(value.typography),
    };
  }
  if (type === 'spacer' && isNumber(value.height)) {
    return {
      id: value.id,
      type,
      height: value.height,
      animation: parseAnimation(value.animation),
      effect: parseEffect(value.effect),
      typography: parseTypography(value.typography),
    };
  }
  if (type === 'accordion' && Array.isArray(value.children) && value.children.length >= 1) {
    const children: Extract<MobileComponent, { type: 'accordion' }>['children'] = [];
    for (const item of value.children) {
      if (isObject(item) && item.type === 'accordion') return null;
      const parsed = parseComponent(item);
      if (!parsed || parsed.type === 'accordion') return null;
      if (isObject(item) && item.hidden === true) {
        children.push({ ...parsed, hidden: true });
      } else {
        children.push(parsed);
      }
    }
    if (children.length < 1) return null;
    return {
      id: value.id,
      type,
      children,
      defaultOpen: value.defaultOpen === true,
      showChevron: value.showChevron !== false,
      chevronColor:
        isString(value.chevronColor) && value.chevronColor.trim()
          ? value.chevronColor.trim().slice(0, 64)
          : undefined,
      chevronThickness: isNumber(value.chevronThickness)
        ? Math.max(1, Math.min(8, Math.round(value.chevronThickness)))
        : undefined,
      chevronAnimation: parseChevronAnimation(value.chevronAnimation),
      chevronDirection: parseChevronDirection(value.chevronDirection),
      animation: parseAnimation(value.animation),
      effect: parseEffect(value.effect),
      typography: parseTypography(value.typography),
    };
  }
  return null;
}

export function parseMobileMenuDocument(value: unknown): MobileMenuDocument | null {
  if (!isObject(value)) return null;
  if (!isObject(value.viewport) || !isObject(value.theme) || !Array.isArray(value.components)) return null;
  const version = value.version;
  if (version !== MOBILE_MENU_VERSION) return null;

  const presetId = isString(value.viewport.presetId) ? value.viewport.presetId : null;
  if (!presetId || !MOBILE_DEVICE_PRESETS.some((p) => p.id === presetId)) return null;
  if (!isNumber(value.viewport.width) || !isNumber(value.viewport.height)) return null;

  const theme = value.theme;
  if (!isString(theme.backgroundColor) || !isString(theme.textColor) || !isString(theme.accentColor) || !isString(theme.fontFamily)) {
    return null;
  }

  const components: MobileComponent[] = [];
  for (const item of value.components) {
    const parsed = parseComponent(item);
    if (!parsed) return null;
    if (isObject(item) && item.hidden === true) {
      components.push({ ...parsed, hidden: true });
    } else {
      components.push(parsed);
    }
  }

  return {
    version: MOBILE_MENU_VERSION,
    viewport: {
      width: value.viewport.width,
      height: value.viewport.height,
      presetId: presetId as MobileMenuDocument['viewport']['presetId'],
    },
    theme: {
      backgroundColor: theme.backgroundColor,
      textColor: theme.textColor,
      accentColor: theme.accentColor,
      fontFamily: theme.fontFamily,
    },
    components,
  };
}

export function normalizeMobileMenuDocument(value: unknown): MobileMenuDocument {
  return parseMobileMenuDocument(value) ?? createDefaultMobileMenuDocument();
}
