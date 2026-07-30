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
