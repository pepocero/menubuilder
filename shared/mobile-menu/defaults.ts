import type {
  MobileAnimationConfig,
  MobileEffectConfig,
  MobileTypographyConfig,
  DevicePresetId,
  MobileComponent,
  MobileDevicePreset,
  MobileMenuDocument,
} from './types';
import { MOBILE_MENU_VERSION } from './types';

export const MOBILE_DEVICE_PRESETS: MobileDevicePreset[] = [
  { id: 'iphone_13_14', label: 'iPhone 13/14', width: 390, height: 844 },
  { id: 'iphone_15_pro', label: 'iPhone 15 Pro', width: 393, height: 852 },
  { id: 'iphone_15_pro_max', label: 'iPhone 15 Pro Max', width: 430, height: 932 },
  { id: 'samsung_s23', label: 'Samsung S23', width: 393, height: 873 },
  { id: 'samsung_s24', label: 'Samsung S24', width: 393, height: 852 },
  { id: 'samsung_a54', label: 'Samsung A54', width: 412, height: 915 },
  { id: 'xiaomi_13', label: 'Xiaomi 13', width: 393, height: 873 },
  { id: 'xiaomi_13_pro', label: 'Xiaomi 13 Pro', width: 412, height: 915 },
  { id: 'xiaomi_redmi_note_13', label: 'Xiaomi Redmi Note 13', width: 412, height: 915 },
];

export const DEFAULT_DEVICE_PRESET_ID: DevicePresetId = 'iphone_15_pro';

export const MOBILE_COMPONENT_LIBRARY: Array<{ type: MobileComponent['type']; label: string }> = [
  { type: 'section', label: 'Seccion' },
  { type: 'heading', label: 'Titulo' },
  { type: 'text', label: 'Texto' },
  { type: 'menuItem', label: 'Plato' },
  { type: 'image', label: 'Imagen' },
  { type: 'button', label: 'Boton' },
  { type: 'divider', label: 'Separador' },
  { type: 'spacer', label: 'Espaciador' },
];

function presetOrDefault(id: DevicePresetId) {
  return MOBILE_DEVICE_PRESETS.find((p) => p.id === id) ?? MOBILE_DEVICE_PRESETS[0];
}

function defaultAnimation(): MobileAnimationConfig {
  return {
    preset: 'none',
    trigger: 'on_view',
    durationMs: 450,
    delayMs: 0,
    intensity: 1,
  };
}

function defaultEffect(): MobileEffectConfig {
  return {
    type: 'none',
    repeat: 'once',
    trigger: 'on_view',
    durationMs: 600,
    delayMs: 0,
  };
}

function defaultTypography(patch?: Partial<MobileTypographyConfig>): MobileTypographyConfig {
  return {
    fontFamily: 'Inter, system-ui, Arial, sans-serif',
    fontSize: 16,
    fontWeight: 400,
    fontStyle: 'normal',
    textDecoration: 'none',
    textTransform: 'none',
    textAlign: 'left',
    lineHeight: 1.45,
    letterSpacing: 0,
    color: '#111827',
    ...patch,
  };
}

function defaultSectionAction() {
  return {
    type: 'none' as const,
  };
}

function defaultButtonAction(href: string) {
  return {
    type: 'url' as const,
    url: href,
  };
}

export type MenuItemTypographyField = 'title' | 'description' | 'price' | 'ingredients';

export function defaultMenuItemFieldTypography(field: MenuItemTypographyField): MobileTypographyConfig {
  switch (field) {
    case 'title':
      return defaultTypography({ fontSize: 18, fontWeight: 700, lineHeight: 1.25 });
    case 'description':
      return defaultTypography({ fontSize: 14, color: '#374151', lineHeight: 1.4 });
    case 'price':
      return defaultTypography({ fontSize: 16, fontWeight: 700, textAlign: 'right' });
    case 'ingredients':
      return defaultTypography({ fontSize: 12, color: '#6b7280', lineHeight: 1.35 });
  }
}

export function createDefaultMobileComponent(type: MobileComponent['type']): MobileComponent {
  const id = `mob_${crypto.randomUUID().slice(0, 8)}`;
  switch (type) {
    case 'section':
      return {
        id,
        type,
        title: 'Nueva seccion',
        backgroundColor: '#ffffff',
        padding: 16,
        size: 's',
        borderLine: 'thin',
        borderRound: 'md',
        backgroundImage: {
          src: '',
          align: 'center',
          stretch: true,
        },
        action: defaultSectionAction(),
        animation: defaultAnimation(),
        effect: defaultEffect(),
        typography: defaultTypography({ fontSize: 18, fontWeight: 700 }),
      };
    case 'heading':
      return {
        id,
        type,
        text: 'Titulo de seccion',
        animation: defaultAnimation(),
        effect: defaultEffect(),
        typography: defaultTypography({ fontSize: 28, fontWeight: 700 }),
      };
    case 'text':
      return {
        id,
        type,
        text: 'Texto descriptivo del menu.',
        listStyle: 'none',
        indentPx: 0,
        animation: defaultAnimation(),
        effect: defaultEffect(),
        typography: defaultTypography({ color: '#374151' }),
      };
    case 'image':
      return {
        id,
        type,
        src: '',
        alt: 'Imagen del plato',
        radius: 12,
        animation: defaultAnimation(),
        effect: defaultEffect(),
        typography: defaultTypography(),
      };
    case 'menuItem':
      return {
        id,
        type,
        title: 'Nombre del plato',
        description: 'Descripcion breve del plato',
        price: '12,00€',
        ingredients: 'Ingrediente 1 - Ingrediente 2 - Ingrediente 3',
        allergens: '',
        backgroundColor: '#ffffff',
        menuImage: {
          src: '',
          alt: 'Imagen del plato',
          position: 'left',
          width: 92,
          radius: 10,
        },
        animation: defaultAnimation(),
        effect: defaultEffect(),
        menuTypography: {
          title: defaultMenuItemFieldTypography('title'),
          description: defaultMenuItemFieldTypography('description'),
          price: defaultMenuItemFieldTypography('price'),
          ingredients: defaultMenuItemFieldTypography('ingredients'),
        },
      };
    case 'button':
      return {
        id,
        type,
        label: 'Reservar',
        href: '#',
        action: defaultButtonAction('#'),
        backgroundColor: '#111827',
        textColor: '#ffffff',
        animation: defaultAnimation(),
        effect: defaultEffect(),
        typography: defaultTypography({ textAlign: 'center', color: '#ffffff', fontWeight: 600 }),
      };
    case 'divider':
      return {
        id,
        type,
        color: '#e5e7eb',
        thickness: 1,
        animation: defaultAnimation(),
        effect: defaultEffect(),
        typography: defaultTypography(),
      };
    case 'spacer':
      return { id, type, height: 20, animation: defaultAnimation(), effect: defaultEffect(), typography: defaultTypography() };
    case 'accordion':
      return {
        id,
        type,
        children: [
          {
            ...(createDefaultMobileComponent('heading') as Extract<
              MobileComponent,
              { type: 'heading' }
            >),
            text: 'Cabecera del acordeón',
          },
          {
            ...(createDefaultMobileComponent('text') as Extract<MobileComponent, { type: 'text' }>),
            text: 'Contenido del acordeón.',
          },
        ],
        defaultOpen: false,
        showChevron: true,
        animation: defaultAnimation(),
        effect: defaultEffect(),
      };
  }
}

export function createDefaultMobileMenuDocument(
  presetId: DevicePresetId = DEFAULT_DEVICE_PRESET_ID,
): MobileMenuDocument {
  const preset = presetOrDefault(presetId);
  return {
    version: MOBILE_MENU_VERSION,
    viewport: {
      width: preset.width,
      height: preset.height,
      presetId: preset.id,
    },
    theme: {
      backgroundColor: '#f8fafc',
      textColor: '#111827',
      accentColor: '#f59e0b',
      fontFamily: 'Inter, system-ui, Arial, sans-serif',
    },
    components: [
      createDefaultMobileComponent('heading'),
      createDefaultMobileComponent('text'),
      createDefaultMobileComponent('menuItem'),
      createDefaultMobileComponent('menuItem'),
      createDefaultMobileComponent('button'),
    ],
  };
}
