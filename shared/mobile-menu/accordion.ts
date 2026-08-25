import type {
  MobileAccordionChild,
  MobileAccordionComponent,
  MobileComponent,
} from './types';

export interface MobileComponentLocation {
  component: MobileComponent;
  /** Índice en la lista de nivel superior (si es top-level) o del acordeón padre. */
  index: number;
  parentAccordionId?: string;
  parentAccordionIndex?: number;
}

/** Busca un componente por id en la lista plana o dentro de acordeones. */
export function findMobileComponentById(
  components: MobileComponent[],
  id: string,
): MobileComponentLocation | null {
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index];
    if (component.id === id) {
      return { component, index };
    }
    if (component.type === 'accordion') {
      for (let childIndex = 0; childIndex < component.children.length; childIndex += 1) {
        const child = component.children[childIndex];
        if (child.id === id) {
          return {
            component: child,
            index: childIndex,
            parentAccordionId: component.id,
            parentAccordionIndex: index,
          };
        }
      }
    }
  }
  return null;
}

/** Actualiza un componente por id (top-level o hijo de acordeón). */
export function updateMobileComponentById(
  components: MobileComponent[],
  id: string,
  updater: (component: MobileComponent) => MobileComponent,
): MobileComponent[] {
  return components.map((component) => {
    if (component.id === id) return updater(component);
    if (component.type !== 'accordion') return component;
    let changed = false;
    const children = component.children.map((child) => {
      if (child.id !== id) return child;
      changed = true;
      const next = updater(child);
      if (next.type === 'accordion') return child;
      return next as MobileAccordionChild;
    });
    return changed ? { ...component, children } : component;
  });
}

/** Recorre todos los componentes (incluidos hijos de acordeón). */
export function mapAllMobileComponents(
  components: MobileComponent[],
  mapper: (component: MobileComponent) => MobileComponent,
): MobileComponent[] {
  return components.map((component) => {
    const next = mapper(component);
    if (next.type === 'accordion') {
      const children = next.children.map((child) => {
        const mapped = mapper(child);
        return mapped.type === 'accordion' ? child : (mapped as MobileAccordionChild);
      });
      return { ...next, children };
    }
    return next;
  });
}

/** Cuenta componentes de un tipo (top-level y dentro de acordeones). */
export function countMobileComponentsByType(
  components: MobileComponent[],
  type: MobileComponent['type'],
): number {
  let count = 0;
  for (const component of components) {
    if (component.type === type) count += 1;
    if (component.type === 'accordion') {
      for (const child of component.children) {
        if (child.type === type) count += 1;
      }
    }
  }
  return count;
}

/** Cuenta platos en el documento (top-level y dentro de acordeones). */
export function countMobileMenuItems(components: MobileComponent[]): number {
  return countMobileComponentsByType(components, 'menuItem');
}

/** Elimina un componente por id. Si queda un acordeón sin hijos, se elimina el acordeón. */
export function removeMobileComponentById(
  components: MobileComponent[],
  id: string,
): MobileComponent[] {
  const result: MobileComponent[] = [];
  for (const component of components) {
    if (component.id === id) continue;
    if (component.type === 'accordion') {
      const children = component.children.filter((child) => child.id !== id);
      if (children.length === 0) continue;
      if (children.length !== component.children.length) {
        result.push({ ...component, children });
        continue;
      }
    }
    result.push(component);
  }
  return result;
}

export function areTopLevelIdsConsecutive(
  components: MobileComponent[],
  ids: string[],
): { ok: true; start: number; end: number } | { ok: false; reason: string } {
  if (ids.length < 2) {
    return { ok: false, reason: 'Selecciona al menos 2 componentes.' };
  }
  const indices = ids.map((id) => components.findIndex((c) => c.id === id));
  if (indices.some((i) => i < 0)) {
    return { ok: false, reason: 'Solo se pueden agrupar componentes de nivel superior.' };
  }
  if (ids.some((id) => components.find((c) => c.id === id)?.type === 'accordion')) {
    return { ok: false, reason: 'No se puede incluir un acordeón dentro de otro.' };
  }
  const sorted = [...indices].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] !== sorted[i - 1] + 1) {
      return { ok: false, reason: 'Los componentes deben estar uno debajo del otro (consecutivos).' };
    }
  }
  return { ok: true, start: sorted[0], end: sorted[sorted.length - 1] };
}

export function createAccordionFromTopLevelIds(
  components: MobileComponent[],
  ids: string[],
): { components: MobileComponent[]; accordionId: string } | { error: string } {
  const consecutive = areTopLevelIdsConsecutive(components, ids);
  if (!consecutive.ok) return { error: consecutive.reason };

  const slice = components.slice(consecutive.start, consecutive.end + 1);
  const children = slice.filter((c): c is MobileAccordionChild => c.type !== 'accordion');
  if (children.length < 2) {
    return { error: 'Se necesitan al menos 2 componentes para crear un acordeón.' };
  }

  const accordion: MobileAccordionComponent = {
    id: `mob_${crypto.randomUUID().slice(0, 8)}`,
    type: 'accordion',
    children,
    defaultOpen: false,
    showChevron: true,
  };

  return {
    accordionId: accordion.id,
    components: [
      ...components.slice(0, consecutive.start),
      accordion,
      ...components.slice(consecutive.end + 1),
    ],
  };
}

/**
 * Mueve un hijo del acordeón una posición (arriba/abajo).
 * El índice 0 es la cabecera; el resto es el cuerpo.
 */
export function moveAccordionChildById(
  components: MobileComponent[],
  accordionId: string,
  childId: string,
  direction: -1 | 1,
): MobileComponent[] | null {
  const index = components.findIndex((c) => c.id === accordionId && c.type === 'accordion');
  if (index < 0) return null;
  const accordion = components[index];
  if (accordion.type !== 'accordion') return null;
  const from = accordion.children.findIndex((child) => child.id === childId);
  if (from < 0) return null;
  const to = from + direction;
  if (to < 0 || to >= accordion.children.length) return null;
  const children = [...accordion.children];
  const [moved] = children.splice(from, 1);
  if (!moved) return null;
  children.splice(to, 0, moved);
  const next = [...components];
  next[index] = { ...accordion, children };
  return next;
}

export type MobileActionAnchorKind = 'section' | 'text' | 'button' | 'menuItem';

export interface MobileActionAnchor {
  id: string;
  index: number;
  kind: MobileActionAnchorKind;
  typeLabel: string;
  label: string;
  preview: string;
}

function isActionAnchorKind(type: MobileComponent['type']): type is MobileActionAnchorKind {
  return type === 'section' || type === 'text' || type === 'button' || type === 'menuItem';
}

function typeLabelForAnchor(kind: MobileActionAnchorKind): string {
  if (kind === 'section') return 'Sección';
  if (kind === 'text') return 'Texto';
  if (kind === 'button') return 'Botón';
  return 'Plato';
}

function clipAnchorText(value: string, max = 48): string {
  const next = value.replace(/\s+/g, ' ').trim();
  if (next.length <= max) return next;
  return `${next.slice(0, max - 1).trimEnd()}…`;
}

function componentAnchorLabel(
  component: Extract<MobileComponent, { type: MobileActionAnchorKind }>,
  ordinal: number,
): string {
  if (component.type === 'section') return component.title.trim() || `Sección ${ordinal}`;
  if (component.type === 'text') {
    const line = component.text.replace(/\s+/g, ' ').trim();
    return line || `Texto ${ordinal}`;
  }
  if (component.type === 'button') return component.label.trim() || `Botón ${ordinal}`;
  return component.title.trim() || `Plato ${ordinal}`;
}

function sectionFollowPreview(items: MobileComponent[]): string {
  for (const next of items) {
    if (next.type === 'section') break;
    if (next.type === 'heading' && next.text.trim()) return next.text.trim();
    if (next.type === 'text' && next.text.trim()) return next.text.trim();
    if (next.type === 'menuItem' && next.title.trim()) return next.title.trim();
  }
  return '';
}

/**
 * Destinos de «Ir a…»: sección, texto, botón y plato, también dentro de acordeones.
 * El runtime hace scroll por `id`.
 */
export function listSelectableActionAnchors(
  components: MobileComponent[],
): MobileActionAnchor[] {
  const anchors: MobileActionAnchor[] = [];
  const ordinals: Record<MobileActionAnchorKind, number> = {
    section: 0,
    text: 0,
    button: 0,
    menuItem: 0,
  };
  let index = 0;

  const push = (
    component: Extract<MobileComponent, { type: MobileActionAnchorKind }>,
    preview: string,
  ) => {
    const kind = component.type;
    ordinals[kind] += 1;
    index += 1;
    anchors.push({
      id: component.id,
      index,
      kind,
      typeLabel: typeLabelForAnchor(kind),
      label: clipAnchorText(componentAnchorLabel(component, ordinals[kind])),
      preview: clipAnchorText(preview),
    });
  };

  const visit = (items: MobileComponent[], inAccordion: boolean) => {
    for (let i = 0; i < items.length; i += 1) {
      const component = items[i];
      if (component.type === 'accordion') {
        visit(component.children, true);
        continue;
      }
      if (!isActionAnchorKind(component.type)) continue;
      if (component.type === 'section') {
        const follow = sectionFollowPreview(items.slice(i + 1));
        const fallback = inAccordion
          ? i === 0
            ? 'Cabecera de acordeón'
            : 'Dentro del acordeón'
          : '';
        push(component, follow || fallback);
        continue;
      }
      push(component, inAccordion ? 'En acordeón' : '');
    }
  };

  visit(components, false);
  return anchors;
}

export function ungroupAccordionById(
  components: MobileComponent[],
  accordionId: string,
): MobileComponent[] | null {
  const index = components.findIndex((c) => c.id === accordionId && c.type === 'accordion');
  if (index < 0) return null;
  const accordion = components[index];
  if (accordion.type !== 'accordion') return null;
  return [
    ...components.slice(0, index),
    ...accordion.children,
    ...components.slice(index + 1),
  ];
}
