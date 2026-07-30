import type { MenuOcrResult } from '@shared/menu-ocr';
import {
  createDefaultMobileComponent,
  type MobileComponent,
  type MobileMenuItemComponent,
  type MobileSectionComponent,
  type MobileHeadingComponent,
  type MobileTextComponent,
} from '@shared/mobile-menu';
import { looksLikeSectionTitle, parseMenuTextBlocks } from '@/lib/text-to-menu-line';

function sortSections(menu: MenuOcrResult) {
  const columnRank = (column: string) => {
    if (column === 'full') return 0;
    if (column === 'left') return 1;
    if (column === 'right') return 2;
    return 3;
  };
  return [...menu.sections].sort((a, b) => {
    const col = columnRank(a.column) - columnRank(b.column);
    if (col !== 0) return col;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

function createSection(title: string): MobileSectionComponent {
  const base = createDefaultMobileComponent('section') as MobileSectionComponent;
  return {
    ...base,
    title,
    action: { type: 'none' },
  };
}

function createHeading(text: string): MobileHeadingComponent {
  const base = createDefaultMobileComponent('heading') as MobileHeadingComponent;
  return { ...base, text };
}

function createText(text: string): MobileTextComponent {
  const base = createDefaultMobileComponent('text') as MobileTextComponent;
  return {
    ...base,
    text,
    listStyle: 'none',
    indentPx: 0,
  };
}

function createMenuItem(params: {
  title: string;
  price: string;
  ingredients: string;
}): MobileMenuItemComponent {
  const base = createDefaultMobileComponent('menuItem') as MobileMenuItemComponent;
  const price = params.price.replace(/(\d)\s+€/g, '$1€').replace(/€\s+(\d)/g, '€$1');
  return {
    ...base,
    title: params.title,
    description: '',
    price,
    ingredients: params.ingredients,
    allergens: '',
    menuImage: {
      src: '',
      alt: 'Imagen del plato',
      position: 'left',
      width: 92,
      radius: 10,
    },
  };
}

/**
 * Convierte el resultado OCR de visión en componentes del editor móvil.
 * - Secciones → `section`
 * - Platos (nombre + precio + ingredientes si hay) → `menuItem`
 * - Sin alérgenos
 */
export function menuOcrResultToMobileComponents(menu: MenuOcrResult): MobileComponent[] {
  const components: MobileComponent[] = [];

  const headerTitle = menu.headerTitle?.trim() ?? '';
  const headerSubtitle = menu.headerSubtitle?.trim() ?? '';
  if (headerTitle) components.push(createHeading(headerTitle));
  if (headerSubtitle) components.push(createText(headerSubtitle));

  for (const section of sortSections(menu)) {
    const sectionTitle = section.title?.trim() ?? '';
    if (sectionTitle) components.push(createSection(sectionTitle));

    const body = section.body?.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim() ?? '';
    if (!body) continue;

    const rows = parseMenuTextBlocks(body);
    for (const row of rows) {
      const title = row.left.trim();
      if (!title) continue;

      // Evitar duplicar el título de sección si el body lo repite.
      if (
        !row.hasPrice &&
        !row.ingredients &&
        looksLikeSectionTitle(title) &&
        (!sectionTitle || title.toLocaleLowerCase('es') === sectionTitle.toLocaleLowerCase('es'))
      ) {
        continue;
      }

      components.push(
        createMenuItem({
          title,
          price: row.right.trim(),
          ingredients: row.ingredients?.trim() ?? '',
        }),
      );
    }
  }

  return components;
}

export function countMobileOcrMenuItems(components: MobileComponent[]): number {
  return components.filter((c) => c.type === 'menuItem').length;
}
