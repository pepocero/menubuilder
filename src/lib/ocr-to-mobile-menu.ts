import { isUsableOcrBox, type MenuOcrResult, type MenuOcrSection } from '@shared/menu-ocr';
import {
  createDefaultMobileComponent,
  type MobileComponent,
  type MobileMenuItemComponent,
  type MobileSectionComponent,
  type MobileHeadingComponent,
  type MobileTextComponent,
} from '@shared/mobile-menu';
import {
  looksLikeDishNameOnly,
  looksLikeSectionSubtitle,
  looksLikeSectionTitle,
  parseMenuTextBlocks,
} from '@/lib/text-to-menu-line';

function sortSections(menu: MenuOcrResult) {
  const sectionAnchor = (section: MenuOcrResult['sections'][number]) => {
    const box =
      (isUsableOcrBox(section.titleBox) && section.titleBox) ||
      (isUsableOcrBox(section.bodyBox) && section.bodyBox) ||
      (isUsableOcrBox(section.box) && section.box) ||
      null;
    if (!box) return null;
    return { y: box.y, x: box.x };
  };
  return [...menu.sections].sort((a, b) => {
    const anchorA = sectionAnchor(a);
    const anchorB = sectionAnchor(b);
    if (anchorA && anchorB) {
      const y = anchorA.y - anchorB.y;
      if (Math.abs(y) > 0.45) return y;
      const x = anchorA.x - anchorB.x;
      if (Math.abs(x) > 0.45) return x;
    }

    // Fallback al orden declarado por OCR (dentro de columna).
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

function createSection(title: string): MobileSectionComponent {
  const base = createDefaultMobileComponent('section') as MobileSectionComponent;
  return {
    ...base,
    title,
    size: 'auto',
    borderLine: 'none',
    borderRound: 'md',
    backgroundColor: '#d21e1e',
    action: { type: 'none' },
    typography: {
      ...base.typography!,
      fontSize: 22,
      fontWeight: 700,
      textAlign: 'center',
      color: '#ffffff',
    },
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

function createSubtitleText(text: string): MobileTextComponent {
  const base = createText(text);
  const typography = base.typography!;
  return {
    ...base,
    typography: {
      ...typography,
      fontSize: 15,
      fontWeight: 500,
      textAlign: 'center',
      fontStyle: 'italic',
      color: '#4b5563',
    },
  };
}

function createFooterNoteHeading(text: string): MobileTextComponent {
  const base = createText(text);
  const typography = base.typography!;
  return {
    ...base,
    typography: {
      ...typography,
      fontSize: 14,
      fontWeight: 700,
      textAlign: 'center',
      textTransform: 'uppercase',
      color: '#374151',
    },
  };
}

function createFooterNoteLine(text: string): MobileTextComponent {
  const base = createText(text);
  const typography = base.typography!;
  return {
    ...base,
    typography: {
      ...typography,
      fontSize: 13,
      fontWeight: 500,
      textAlign: 'center',
      color: '#6b7280',
    },
  };
}

const FOOTER_NOTES_TITLE_RE =
  /\b(iva|impuestos?|tax|incluido|incluida|incluidos|incluidas|suplemento|recargo|service|terraza|cubierto)\b/i;

const FOOTER_NOTES_LINE_RE =
  /\b(iva|impuestos?|tax|suplemento|recargo|service|terraza|cubierto|%\s*$)\b/i;

function normalizeLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function sameText(a: string, b: string): boolean {
  return normalizeLine(a).toLocaleLowerCase('es') === normalizeLine(b).toLocaleLowerCase('es');
}

function isFooterNoteTitle(title: string): boolean {
  return FOOTER_NOTES_TITLE_RE.test(normalizeLine(title));
}

function isFooterNoteLine(text: string): boolean {
  return FOOTER_NOTES_LINE_RE.test(normalizeLine(text));
}

function hasPercentSymbol(text: string): boolean {
  return normalizeLine(text).includes('%');
}

function createMenuItem(params: {
  title: string;
  price: string;
  description?: string;
  ingredients: string;
}): MobileMenuItemComponent {
  const base = createDefaultMobileComponent('menuItem') as MobileMenuItemComponent;
  const price = params.price.replace(/(\d)\s+€/g, '$1€').replace(/€\s+(\d)/g, '€$1');
  return {
    ...base,
    title: params.title,
    description: params.description?.trim() ?? '',
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
 * Recupera título/subtítulo si el OCR los dejó en body o mezclados.
 * Devuelve body limpio (sin título/subtítulo) listo para parsear platos.
 */
export function resolveSectionTitleSubtitleBody(section: MenuOcrSection): {
  title: string;
  subtitle: string;
  body: string;
} {
  let title = section.title?.trim() ?? '';
  let subtitle = section.subtitle?.trim() ?? '';
  const rawBody = section.body?.replace(/\r\n/g, '\n').replace(/\r/g, '\n') ?? '';
  const lines = rawBody.split('\n');
  let start = 0;

  while (start < lines.length && !normalizeLine(lines[start] ?? '')) start += 1;

  const takeLine = (): string => {
    const line = normalizeLine(lines[start] ?? '');
    start += 1;
    while (start < lines.length && !normalizeLine(lines[start] ?? '')) start += 1;
    return line;
  };

  const peekLine = (): string => normalizeLine(lines[start] ?? '');

  // Título faltante o duplicado al inicio del body.
  if (start < lines.length) {
    const first = peekLine();
    if (first) {
      if (!title && looksLikeSectionTitle(first)) {
        title = takeLine();
      } else if (title && sameText(first, title)) {
        takeLine();
      }
    }
  }

  // Subtítulo explícito o recuperado de la primera línea descriptiva.
  if (start < lines.length) {
    const next = peekLine();
    if (next) {
      if (subtitle && sameText(next, subtitle)) {
        takeLine();
      } else if (!subtitle && looksLikeSectionSubtitle(next)) {
        subtitle = takeLine();
      }
    }
  }

  const body = lines.slice(start).join('\n').trim();
  return { title, subtitle, body };
}

/**
 * Convierte el resultado OCR de visión en componentes del editor móvil.
 * - Título de categoría → `section`
 * - Subtítulo → `text`
 * - Platos (nombre + precio + ingredientes/descripción) → `menuItem`
 * - Sin alérgenos
 */
export function menuOcrResultToMobileComponents(menu: MenuOcrResult): MobileComponent[] {
  const components: MobileComponent[] = [];
  const footerNotes: string[] = [];

  const headerTitle = menu.headerTitle?.trim() ?? '';
  const headerSubtitle = menu.headerSubtitle?.trim() ?? '';
  // Cabecera del local: si viene en MAYÚSCULAS tipo categoría → Sección; si no, Título.
  if (headerTitle) {
    if (looksLikeSectionTitle(headerTitle)) {
      components.push(createSection(headerTitle));
    } else {
      components.push(createHeading(headerTitle));
    }
  }
  if (headerSubtitle) components.push(createSubtitleText(headerSubtitle));

  for (const section of sortSections(menu)) {
    const { title: sectionTitle, subtitle: sectionSubtitle, body } =
      resolveSectionTitleSubtitleBody(section);
    const rows = body ? parseMenuTextBlocks(body) : [];
    const hasMenuItems = rows.some((row) => row.hasPrice);
    const looksLikeFooterNotes =
      !!sectionTitle &&
      isFooterNoteTitle(sectionTitle) &&
      !hasMenuItems &&
      rows.every((row) => !row.hasPrice && isFooterNoteLine(row.left));

    if (looksLikeFooterNotes) {
      footerNotes.push(sectionTitle);
      if (sectionSubtitle) footerNotes.push(sectionSubtitle);
      for (const row of rows) {
        const line = row.left.trim();
        if (line) footerNotes.push(line);
      }
      continue;
    }

    if (sectionTitle && isFooterNoteTitle(sectionTitle) && hasMenuItems) {
      // Si OCR mezcló un título de nota en una sección con platos, al menos conserva la nota.
      footerNotes.push(sectionTitle);
    }

    if (sectionTitle) components.push(createSection(sectionTitle));
    if (sectionSubtitle) components.push(createSubtitleText(sectionSubtitle));
    if (!body) continue;

    const sectionIsFooterLike = !!sectionTitle && isFooterNoteTitle(sectionTitle);
    const lastPricedRowIndex = (() => {
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (rows[i]?.hasPrice) return i;
      }
      return -1;
    })();

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const title = row.left.trim();
      if (!title) continue;

      // Evitar duplicar el título/subtítulo de sección si el body aún los trae.
      if (
        !row.hasPrice &&
        !row.ingredients &&
        !row.description &&
        ((sectionTitle && sameText(title, sectionTitle)) ||
          (sectionSubtitle && sameText(title, sectionSubtitle)) ||
          (looksLikeSectionTitle(title) &&
            (!sectionTitle || sameText(title, sectionTitle))))
      ) {
        continue;
      }

      // Notas legales/comerciales: solo se envían al bloque final si realmente
      // parecen nota (IVA/%, suplemento, etc.) o si están en una sección de notas.
      const isTrailingInsideFooterSection =
        !row.hasPrice && sectionIsFooterLike && rowIndex > lastPricedRowIndex;
      if (
        !row.hasPrice &&
        (isFooterNoteLine(title) || hasPercentSymbol(title) || isTrailingInsideFooterSection)
      ) {
        footerNotes.push(title);
        continue;
      }

      // Subtítulos intermedios sin precio → Texto (no Plato).
      if (
        !row.hasPrice &&
        looksLikeSectionSubtitle(title) &&
        !looksLikeDishNameOnly(title) &&
        !row.ingredients
      ) {
        components.push(createSubtitleText(title));
        continue;
      }

      // Títulos intermedios en MAYÚSCULAS dentro del body → nueva Sección.
      if (!row.hasPrice && looksLikeSectionTitle(title) && !row.ingredients) {
        components.push(createSection(title));
        continue;
      }

      // Las líneas sin precio no deben convertirse a Plato (evita confundir subtítulos/notas).
      if (!row.hasPrice) {
        components.push(createText(title));
        continue;
      }

      components.push(
        createMenuItem({
          title,
          price: row.right.trim(),
          description: row.description?.trim() ?? '',
          ingredients: row.ingredients?.trim() ?? '',
        }),
      );
    }
  }

  if (footerNotes.length > 0) {
    components.push(createFooterNoteHeading(footerNotes[0]));
    for (const line of footerNotes.slice(1)) {
      const text = line.trim();
      if (!text) continue;
      components.push(createFooterNoteLine(text));
    }
  }

  return components;
}

export function countMobileOcrMenuItems(components: MobileComponent[]): number {
  return components.filter((c) => c.type === 'menuItem').length;
}
