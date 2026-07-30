import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import {
  defaultMenuItemFieldTypography,
  resolveSectionBorderStyle,
  resolveSectionMinHeight,
  type MobileComponent,
  type MobileEffectConfig,
  type MobileInteractionAction,
  type MobileMenuDocument,
  type MobileTypographyConfig,
} from '@shared/mobile-menu';
import { ensureEditorFontLoaded } from '@/lib/google-fonts';

interface MobileRuntimeRendererProps {
  document: MobileMenuDocument;
  editable?: boolean;
  selectedId?: string | null;
  /** Selección múltiple (resaltado). Si no se pasa, se usa selectedId. */
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  /** Reordenar componentes arrastrándolos en el marco móvil (solo editable). */
  onReorder?: (orderedIds: string[]) => void;
  /** Eliminar componente desde el marco (solo editable). */
  onDelete?: (id: string) => void;
  animationPreview?: { componentId: string; nonce: number } | null;
  /** En preview del editor: abre URLs en pestaña nueva en vez de salir del editor. */
  openLinksInNewTab?: boolean;
}

function typographyStyle(component: MobileComponent): CSSProperties {
  const t = component.typography;
  if (!t) return {};
  return {
    fontFamily: t.fontFamily,
    fontSize: `${t.fontSize}px`,
    fontWeight: t.fontWeight,
    fontStyle: t.fontStyle,
    textDecoration: t.textDecoration,
    textTransform: t.textTransform,
    textAlign: t.textAlign,
    lineHeight: String(t.lineHeight),
    letterSpacing: `${t.letterSpacing}px`,
    color: t.color,
  };
}

function typographyConfigToStyle(t: MobileTypographyConfig): CSSProperties {
  return {
    fontFamily: t.fontFamily,
    fontSize: `${t.fontSize}px`,
    fontWeight: t.fontWeight,
    fontStyle: t.fontStyle,
    textDecoration: t.textDecoration,
    textTransform: t.textTransform,
    textAlign: t.textAlign,
    lineHeight: String(t.lineHeight),
    letterSpacing: `${t.letterSpacing}px`,
    color: t.color,
  };
}

function menuItemTypographyStyle(
  component: Extract<MobileComponent, { type: 'menuItem' }>,
  key: 'title' | 'description' | 'price' | 'ingredients',
): CSSProperties {
  const t = {
    ...defaultMenuItemFieldTypography(key),
    ...component.menuTypography?.[key],
  };
  return typographyConfigToStyle(t);
}

/** Precio móvil: sin espacio entre cifra y € (p. ej. 6,00€). */
function formatMenuItemPrice(price: string): string {
  return price.replace(/(\d)\s+€/g, '$1€').replace(/€\s+(\d)/g, '€$1');
}

const EFFECT_KEYFRAMES: Record<string, string> = {
  pulse: 'mob-effect-pulse',
  shake: 'mob-effect-shake',
  bounce: 'mob-effect-bounce',
  glow: 'mob-effect-glow',
  shimmer: 'mob-effect-shimmer',
  heartbeat: 'mob-effect-heartbeat',
  swing: 'mob-effect-swing',
  rubberBand: 'mob-effect-rubberBand',
  flash: 'mob-effect-flash',
};

function buildEffectAnimation(effect?: MobileEffectConfig): string {
  if (!effect || effect.type === 'none') return '';
  const name = EFFECT_KEYFRAMES[effect.type];
  if (!name) return '';
  const iteration = effect.repeat === 'loop' ? 'infinite' : '1';
  return `${name} ${effect.durationMs}ms ease ${effect.delayMs}ms ${iteration} both`;
}

function effectStyle(effect?: MobileEffectConfig): CSSProperties {
  if (!effect || effect.type === 'none') return {};
  if (effect.trigger === 'on_view') return {};
  const anim = buildEffectAnimation(effect);
  return anim ? { animation: anim } : {};
}

function effectClassName(effect?: MobileEffectConfig): string {
  if (effect?.type === 'shimmer') return 'mob-effect-shimmer-bg';
  return '';
}

function parseAllergenList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\n,;·•]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function AllergenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 2a1 1 0 0 1 .9.55l1.4 2.8 3.1.45a1 1 0 0 1 .55 1.7l-2.25 2.2.53 3.1a1 1 0 0 1-1.45 1.05L12 12.9l-2.78 1.45a1 1 0 0 1-1.45-1.05l.53-3.1-2.25-2.2a1 1 0 0 1 .55-1.7l3.1-.45 1.4-2.8A1 1 0 0 1 12 2zm0 4.2-.7 1.4a1 1 0 0 1-.75.55l-1.55.22 1.12 1.1a1 1 0 0 1 .29.88l-.26 1.55 1.4-.73a1 1 0 0 1 .9 0l1.4.73-.26-1.55a1 1 0 0 1 .29-.88l1.12-1.1-1.55-.22a1 1 0 0 1-.75-.55L12 6.2zM11 15h2v5h-2v-5z"
      />
    </svg>
  );
}

function SectionBackgroundImage({
  image,
}: {
  image?: {
    src: string;
    align: 'left' | 'center' | 'right';
    stretch: boolean;
  };
}) {
  const src = image?.src?.trim();
  if (!src) return null;
  const align = image?.align === 'left' || image?.align === 'right' ? image.align : 'center';
  return (
    <img
      className={`mobile-section-bg align-${align}${image?.stretch !== false ? ' is-stretch' : ''}`}
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      aria-hidden="true"
    />
  );
}

function renderComponent(
  component: MobileComponent,
  onAction?: (action: MobileInteractionAction) => void,
  onImageClick?: (src: string) => void,
  onAllergensOpen?: (payload: { dishTitle: string; allergens: string[] }) => void,
) {
  switch (component.type) {
    case 'section': {
      const hasBg = !!component.backgroundImage?.src?.trim();
      const minHeight = resolveSectionMinHeight(component.size);
      const borderStyle = resolveSectionBorderStyle(component.borderLine, component.borderRound);
      const sectionClass = `mobile-block mobile-block-section${hasBg ? ' has-bg-image' : ''}${
        minHeight > 0 ? ' has-fixed-size' : ''
      }`;
      const sectionStyle: CSSProperties = {
        backgroundColor: component.backgroundColor,
        padding: `${component.padding}px`,
        ...(minHeight > 0 ? { minHeight: `${minHeight}px` } : {}),
        ...borderStyle,
      };
      const title = (
        <h3
          style={{
            ...typographyStyle(component),
            ...(component.textOffsetX
              ? { marginLeft: `${component.textOffsetX}px` }
              : {}),
            ...(component.textOffsetY
              ? { marginTop: `${component.textOffsetY}px` }
              : {}),
          }}
        >
          {component.title}
        </h3>
      );
      if (onAction) {
        return (
          <button
            type="button"
            className={`${sectionClass} mobile-block-hit`}
            style={sectionStyle}
            onClick={() => onAction(component.action ?? { type: 'none' })}
          >
            <SectionBackgroundImage image={component.backgroundImage} />
            {title}
          </button>
        );
      }
      return (
        <section className={sectionClass} style={sectionStyle}>
          <SectionBackgroundImage image={component.backgroundImage} />
          {title}
        </section>
      );
    }
    case 'heading':
      return (
        <h2
          className="mobile-block mobile-block-heading"
          style={typographyStyle(component)}
        >
          {component.text}
        </h2>
      );
    case 'text': {
      const listMode =
        component.listStyle === 'bullet' || component.listStyle === 'number'
          ? component.listStyle
          : 'none';
      const indentPx = Math.max(0, Math.min(96, component.indentPx ?? 0));
      const indentStyle = indentPx > 0 ? { paddingLeft: `${indentPx}px` } : undefined;
      if (listMode !== 'none') {
        const items = component.text.split(/\r?\n/);
        const ListTag = listMode === 'number' ? 'ol' : 'ul';
        return (
          <ListTag
            className={`mobile-block mobile-block-text is-list is-list-${listMode}`}
            style={{ ...typographyStyle(component), ...indentStyle }}
          >
            {items.map((item, index) => (
              <li key={`text-li-${index}`}>{item || '\u00A0'}</li>
            ))}
          </ListTag>
        );
      }
      return (
        <p
          className="mobile-block mobile-block-text"
          style={{ ...typographyStyle(component), ...indentStyle }}
        >
          {component.text}
        </p>
      );
    }
    case 'image':
      return component.src ? (
        <img
          className="mobile-block mobile-block-image"
          src={component.src}
          alt={component.alt}
          style={{ borderRadius: `${component.radius}px` }}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      ) : (
        <div className="mobile-block mobile-block-image mobile-block-image-placeholder">
          Sin imagen
        </div>
      );
    case 'menuItem':
      const hasMenuImage = !!component.menuImage?.src.trim();
      const imagePosition = component.menuImage?.position === 'right' ? 'right' : 'left';
      const allergenItems = parseAllergenList(component.allergens);
      return (
        <article
          className={`mobile-block mobile-block-menu-item${
            hasMenuImage ? ` has-image image-${imagePosition}` : ''
          }`}
        >
          {hasMenuImage && (
            <img
              className="mobile-menu-item-thumb"
              src={component.menuImage!.src}
              alt={component.menuImage?.alt || 'Imagen del plato'}
              style={{
                width: `${component.menuImage?.width ?? 92}px`,
                borderRadius: `${component.menuImage?.radius ?? 10}px`,
                cursor: onImageClick ? 'pointer' : undefined,
              }}
              loading="lazy"
              decoding="async"
              draggable={false}
              onClick={onImageClick ? () => onImageClick(component.menuImage!.src) : undefined}
            />
          )}
          <div className="mobile-menu-item-content">
            <header>
              <h4 style={menuItemTypographyStyle(component, 'title')}>{component.title}</h4>
              <strong style={menuItemTypographyStyle(component, 'price')}>
                {formatMenuItemPrice(component.price)}
              </strong>
            </header>
            <p style={menuItemTypographyStyle(component, 'description')}>{component.description}</p>
            {component.ingredients.trim() && (
              <small
                className="mobile-menu-ingredients"
                style={menuItemTypographyStyle(component, 'ingredients')}
              >
                {component.ingredients}
              </small>
            )}
            {allergenItems.length > 0 &&
              (onAllergensOpen ? (
                <button
                  type="button"
                  className="mobile-menu-allergens-btn"
                  title="Ver alérgenos"
                  aria-label={`Alérgenos de ${component.title || 'este plato'}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAllergensOpen({
                      dishTitle: component.title || 'Plato',
                      allergens: allergenItems,
                    });
                  }}
                >
                  <AllergenIcon />
                  <span>Alérgenos</span>
                </button>
              ) : (
                <span className="mobile-menu-allergens-btn" aria-hidden="true">
                  <AllergenIcon />
                  <span>Alérgenos</span>
                </span>
              ))}
          </div>
        </article>
      );
    case 'button':
      if (onAction) {
        return (
          <button
            type="button"
            className="mobile-block mobile-block-button"
            onClick={() => onAction(component.action ?? { type: 'url', url: component.href })}
            style={{ backgroundColor: component.backgroundColor, color: component.textColor, ...typographyStyle(component) }}
          >
            {component.label}
          </button>
        );
      }
      // En el editor: elemento inerte para poder seleccionar/reordenar sin ejecutar la acción.
      return (
        <div
          className="mobile-block mobile-block-button"
          style={{ backgroundColor: component.backgroundColor, color: component.textColor, ...typographyStyle(component) }}
        >
          {component.label}
        </div>
      );
    case 'divider':
      return (
        <hr
          className="mobile-block mobile-block-divider"
          style={{ borderColor: component.color, borderTopWidth: `${component.thickness}px` }}
        />
      );
    case 'spacer':
      return <div className="mobile-block mobile-block-spacer" style={{ height: `${component.height}px` }} />;
    case 'accordion':
      // El acordeón se renderiza con AccordionRuntime (estado abierto/cerrado).
      return null;
  }
}

function AccordionRuntime({
  component,
  editable = false,
  onSelectAccordion,
  onAction,
  onImageClick,
  onAllergensOpen,
}: {
  component: Extract<MobileComponent, { type: 'accordion' }>;
  editable?: boolean;
  onSelectAccordion?: () => void;
  onAction?: (action: MobileInteractionAction) => void;
  onImageClick?: (src: string) => void;
  onAllergensOpen?: (payload: { dishTitle: string; allergens: string[] }) => void;
}) {
  const [open, setOpen] = useState(component.defaultOpen === true);

  useEffect(() => {
    setOpen(component.defaultOpen === true);
  }, [component.id, component.defaultOpen]);

  const header = component.children[0];
  const body = component.children.slice(1).filter((child) => editable || child.hidden !== true);
  const showChevron = component.showChevron !== false;
  const chevronColor = component.chevronColor?.trim() || '#64748b';
  const chevronThickness = Math.max(1, Math.min(8, component.chevronThickness ?? 2));
  const headerIsSection = header?.type === 'section';

  function toggle() {
    setOpen((current) => !current);
    onSelectAccordion?.();
  }

  return (
    <div
      className={`mobile-block mobile-block-accordion${open ? ' is-open' : ''}${
        headerIsSection ? ' has-section-header' : ''
      }${showChevron ? ' has-chevron' : ''}`}
    >
      <div
        className="mobile-accordion-header"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            toggle();
          }
        }}
      >
        <div className="mobile-accordion-header-content">
          {header
            ? renderComponent(
                header,
                // La cabecera no ejecuta acciones propias: el clic abre/cierra el acordeón.
                undefined,
                !editable ? onImageClick : undefined,
                !editable ? onAllergensOpen : undefined,
              )
            : null}
        </div>
        {showChevron && (
          <span
            className={`mobile-accordion-chevron${open ? ' is-open' : ''}`}
            aria-hidden="true"
            style={{ color: chevronColor }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth={chevronThickness}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </div>
      <div
        className="mobile-accordion-panel"
        hidden={!open}
        aria-hidden={!open}
      >
        {body.map((child) => (
          <div key={child.id} className="mobile-accordion-child" data-accordion-child-id={child.id}>
            {renderComponent(
              child,
              !editable ? onAction : undefined,
              !editable ? onImageClick : undefined,
              !editable ? onAllergensOpen : undefined,
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function playNodeAnimationPreview(node: HTMLElement) {
  const preset = node.dataset.animPreset ?? 'none';
  const trigger = node.dataset.animTrigger ?? 'on_view';
  if (preset === 'none') return () => undefined;

  const durationMs = Number.parseInt(node.style.getPropertyValue('--mobile-anim-duration') || '450', 10) || 450;
  const delayMs = Number.parseInt(node.style.getPropertyValue('--mobile-anim-delay') || '0', 10) || 0;
  const timers: number[] = [];

  node.classList.remove(
    'is-anim-preview-tap',
    'is-anim-preview-parallax',
    'is-anim-preview-lottie',
    'is-anim-preview-reveal',
  );

  const cleanup = () => {
    for (const timer of timers) window.clearTimeout(timer);
    node.classList.remove(
      'is-anim-preview-tap',
      'is-anim-preview-parallax',
      'is-anim-preview-lottie',
      'is-anim-preview-reveal',
    );
    node.classList.add('is-anim-visible');
  };

  // El trigger decide cómo se previsualiza.
  if (trigger === 'on_tap') {
    void node.offsetWidth;
    node.classList.add('is-anim-preview-tap');
    timers.push(
      window.setTimeout(() => node.classList.remove('is-anim-preview-tap'), Math.max(220, durationMs)),
    );
    return cleanup;
  }

  // on_load / on_view: reproducen el preset como aparición.
  if (preset === 'reveal') {
    node.classList.remove('is-anim-visible');
    node.classList.add('is-anim-preview-reveal');
    void node.offsetWidth;
    timers.push(
      window.setTimeout(() => {
        node.classList.add('is-anim-visible');
        timers.push(
          window.setTimeout(() => node.classList.remove('is-anim-preview-reveal'), Math.max(durationMs, 300)),
        );
      }, Math.max(40, delayMs)),
    );
    return cleanup;
  }

  if (preset === 'tap') {
    void node.offsetWidth;
    node.classList.add('is-anim-preview-tap');
    timers.push(
      window.setTimeout(() => node.classList.remove('is-anim-preview-tap'), Math.max(220, durationMs)),
    );
    return cleanup;
  }

  if (preset === 'parallax') {
    void node.offsetWidth;
    node.classList.add('is-anim-preview-parallax');
    timers.push(
      window.setTimeout(
        () => node.classList.remove('is-anim-preview-parallax'),
        Math.max(700, durationMs * 2),
      ),
    );
    return cleanup;
  }

  if (preset === 'lottie') {
    void node.offsetWidth;
    node.classList.add('is-anim-preview-lottie');
    timers.push(
      window.setTimeout(
        () => node.classList.remove('is-anim-preview-lottie'),
        Math.max(900, durationMs * 2),
      ),
    );
  }

  return cleanup;
}

export function MobileRuntimeRenderer({
  document,
  editable = false,
  selectedId = null,
  selectedIds,
  onSelect,
  onReorder,
  onDelete,
  animationPreview = null,
  openLinksInNewTab = false,
}: MobileRuntimeRendererProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activeModal, setActiveModal] = useState<{ title: string; body: string; closeLabel: string } | null>(
    null,
  );
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [allergensModal, setAllergensModal] = useState<{ dishTitle: string; allergens: string[] } | null>(
    null,
  );
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [dragOrderIds, setDragOrderIds] = useState<string[] | null>(null);

  const dragActiveIdRef = useRef<string | null>(null);
  const dragOrderIdsRef = useRef<string[] | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; id: string } | null>(null);
  const dragMovedRef = useRef(false);
  const dragFrameRef = useRef<number | null>(null);
  const listeningRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressArmedRef = useRef(false);
  const requireLongPressRef = useRef(false);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevPosRef = useRef<Map<string, number>>(new Map());
  const componentIdsRef = useRef<string[]>(document.components.map((c) => c.id));
  const onReorderRef = useRef(onReorder);
  const onSelectRef = useRef(onSelect);
  componentIdsRef.current = document.components.map((c) => c.id);
  onReorderRef.current = onReorder;
  onSelectRef.current = onSelect;

  const LONG_PRESS_MS = 400;
  const LONG_PRESS_CANCEL_PX = 12;

  const visibleComponents = useMemo(() => {
    if (editable) return document.components;
    return document.components.filter((c) => c.hidden !== true);
  }, [document.components, editable]);

  const displayComponents = useMemo(() => {
    if (!dragOrderIds) return visibleComponents;
    const map = new Map(visibleComponents.map((c) => [c.id, c]));
    return dragOrderIds.map((id) => map.get(id)).filter((c): c is MobileComponent => !!c);
  }, [visibleComponents, dragOrderIds]);

  function capturePositions() {
    const positions = new Map<string, number>();
    for (const [id, el] of nodeRefs.current.entries()) {
      positions.set(id, el.getBoundingClientRect().top);
    }
    prevPosRef.current = positions;
  }

  function getInsertIndex(clientY: number): number | null {
    const activeId = dragActiveIdRef.current;
    const currentIds = dragOrderIdsRef.current;
    if (!currentIds || !activeId) return null;
    const withoutActive = currentIds.filter((id) => id !== activeId);
    if (withoutActive.length === 0) return 0;
    for (let i = 0; i < withoutActive.length; i += 1) {
      const el = nodeRefs.current.get(withoutActive[i]);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return withoutActive.length;
  }

  function updateDrag(clientY: number) {
    const activeId = dragActiveIdRef.current;
    const currentIds = dragOrderIdsRef.current;
    if (!activeId || !currentIds) return;
    const over = getInsertIndex(clientY);
    if (over === null) return;
    const withoutActive = currentIds.filter((id) => id !== activeId);
    const bounded = Math.max(0, Math.min(withoutActive.length, over));
    const nextIds = [...withoutActive];
    nextIds.splice(bounded, 0, activeId);
    if (nextIds.every((id, idx) => id === currentIds[idx])) return;
    capturePositions();
    dragOrderIdsRef.current = nextIds;
    setDragOrderIds(nextIds);
  }

  const onPointerMoveRef = useRef<(e: PointerEvent) => void>(() => undefined);
  const onPointerUpRef = useRef<(e: PointerEvent) => void>(() => undefined);
  const onPointerCancelRef = useRef<(e: PointerEvent) => void>(() => undefined);

  // Wrappers estables: add/removeEventListener necesita la misma referencia.
  const stableMove = useRef((e: PointerEvent) => {
    onPointerMoveRef.current(e);
  }).current;
  const stableUp = useRef((e: PointerEvent) => {
    onPointerUpRef.current(e);
  }).current;
  const stableCancel = useRef((e: PointerEvent) => {
    onPointerCancelRef.current(e);
  }).current;

  function removeDragListeners() {
    if (!listeningRef.current) return;
    listeningRef.current = false;
    window.removeEventListener('pointermove', stableMove);
    window.removeEventListener('pointerup', stableUp);
    window.removeEventListener('pointercancel', stableCancel);
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current == null) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  function armLongPressDrag(id: string) {
    if (longPressArmedRef.current) return;
    longPressArmedRef.current = true;
    dragActiveIdRef.current = id;
    setDragActiveId(id);
    const ids = [...componentIdsRef.current];
    dragOrderIdsRef.current = ids;
    setDragOrderIds(ids);
    capturePositions();
    onSelectRef.current?.(id);
    try {
      navigator.vibrate?.(12);
    } catch {
      /* ignore */
    }
  }

  function endDrag(commit: boolean) {
    clearLongPressTimer();
    const finalIds = dragOrderIdsRef.current;
    const moved = dragMovedRef.current;
    const startId = dragStartRef.current?.id ?? null;
    const wasArmed = longPressArmedRef.current;

    if (commit && moved && wasArmed && finalIds && finalIds.length === componentIdsRef.current.length) {
      onReorderRef.current?.(finalIds);
    } else if (commit && !moved && startId) {
      onSelectRef.current?.(startId);
    }

    dragActiveIdRef.current = null;
    dragOrderIdsRef.current = null;
    dragPointerIdRef.current = null;
    dragStartRef.current = null;
    dragMovedRef.current = false;
    longPressArmedRef.current = false;
    requireLongPressRef.current = false;
    setDragActiveId(null);
    setDragOrderIds(null);
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    removeDragListeners();
  }

  onPointerMoveRef.current = (e: PointerEvent) => {
    if (dragPointerIdRef.current !== e.pointerId) return;
    const start = dragStartRef.current;
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dist = Math.hypot(dx, dy);

    if (!longPressArmedRef.current) {
      if (requireLongPressRef.current) {
        if (dist >= LONG_PRESS_CANCEL_PX) {
          endDrag(false);
        }
        return;
      }
      // Ratón / escritorio: activar al mover un poco (sin pulsación larga).
      if (dist < 6) return;
      armLongPressDrag(start.id);
      dragMovedRef.current = true;
    } else if (!dragMovedRef.current) {
      if (dist < 6) return;
      dragMovedRef.current = true;
    }

    if (dragFrameRef.current !== null) return;
    const clientY = e.clientY;
    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null;
      updateDrag(clientY);
    });
  };

  onPointerUpRef.current = (e: PointerEvent) => {
    if (dragPointerIdRef.current !== e.pointerId) return;
    if (dragMovedRef.current) updateDrag(e.clientY);
    endDrag(true);
  };

  onPointerCancelRef.current = (e: PointerEvent) => {
    if (dragPointerIdRef.current !== e.pointerId) return;
    endDrag(false);
  };

  function animateFlip() {
    const previous = prevPosRef.current;
    for (const [id, el] of nodeRefs.current.entries()) {
      const beforeTop = previous.get(id);
      if (beforeTop === undefined) continue;
      const afterTop = el.getBoundingClientRect().top;
      const deltaY = beforeTop - afterTop;
      if (Math.abs(deltaY) < 0.5) continue;
      el.animate(
        [{ transform: `translateY(${deltaY}px)` }, { transform: 'translateY(0)' }],
        { duration: 170, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      );
    }
  }

  function onNodePointerDown(id: string, e: ReactPointerEvent<HTMLDivElement>) {
    if (!editable || !onReorder) return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('a, button, input, textarea, select, [contenteditable="true"]')) return;

    e.preventDefault();
    removeDragListeners();
    clearLongPressTimer();
    dragPointerIdRef.current = e.pointerId;
    dragStartRef.current = { x: e.clientX, y: e.clientY, id };
    dragMovedRef.current = false;
    longPressArmedRef.current = false;
    requireLongPressRef.current = e.pointerType !== 'mouse';
    listeningRef.current = true;
    window.addEventListener('pointermove', stableMove, { passive: true });
    window.addEventListener('pointerup', stableUp);
    window.addEventListener('pointercancel', stableCancel);

    if (requireLongPressRef.current) {
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        if (dragStartRef.current?.id === id && dragPointerIdRef.current === e.pointerId) {
          armLongPressDrag(id);
        }
      }, LONG_PRESS_MS);
    }
  }

  useEffect(() => {
    if (!dragActiveId || !dragOrderIds) return;
    animateFlip();
    capturePositions();
  }, [dragOrderIds, dragActiveId]);

  useEffect(
    () => () => {
      clearLongPressTimer();
      removeDragListeners();
      if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
    },
    [],
  );

  useEffect(() => {
    for (const component of document.components) {
      const loadFonts = (c: MobileComponent) => {
        if (c.typography?.fontFamily) {
          ensureEditorFontLoaded(c.typography.fontFamily);
        }
        if (c.type === 'menuItem' && c.menuTypography) {
          for (const field of ['title', 'description', 'price', 'ingredients'] as const) {
            const fontFamily =
              c.menuTypography[field]?.fontFamily ??
              defaultMenuItemFieldTypography(field).fontFamily;
            ensureEditorFontLoaded(fontFamily);
          }
        }
        if (c.type === 'accordion') {
          for (const child of c.children) loadFonts(child);
        }
      };
      loadFonts(component);
    }
  }, [document.components]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('.mobile-runtime-node'));

    // En editor el contenido debe permanecer visible; el preview se dispara aparte.
    if (editable) {
      for (const node of nodes) {
        node.classList.add('is-anim-visible');
      }
      return;
    }

    const revealNodes = nodes.filter((node) => node.dataset.animPreset === 'reveal');
    const parallaxNodes = nodes.filter((node) => node.dataset.animPreset === 'parallax');
    const loadNodes = nodes.filter((node) => node.dataset.animTrigger === 'on_load');

    for (const node of loadNodes) {
      if (node.dataset.animPreset === 'none') continue;
      node.classList.remove('is-anim-visible');
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          node.classList.add('is-anim-visible');
        });
      });
    }

    let observer: IntersectionObserver | null = null;
    if (revealNodes.length > 0) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-anim-visible');
              observer?.unobserve(entry.target);
            }
          }
        },
        { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.15 },
      );
      for (const node of revealNodes) {
        if (node.dataset.animTrigger === 'on_load') continue;
        observer.observe(node);
      }
    }

    const applyParallax = () => {
      for (const node of parallaxNodes) {
        const rect = node.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        const center = rect.top + rect.height / 2;
        const delta = (center - vh / 2) / vh;
        const intensity = Number(node.dataset.animIntensity || 1);
        const maxOffset = Math.max(6, 16 * intensity);
        const y = Math.max(-maxOffset, Math.min(maxOffset, -delta * maxOffset));
        node.style.setProperty('--mobile-parallax-y', `${y.toFixed(2)}px`);
      }
    };

    if (parallaxNodes.length > 0) {
      applyParallax();
      window.addEventListener('scroll', applyParallax, { passive: true });
      window.addEventListener('resize', applyParallax);
    }

    /* Effects with on_view trigger */
    const effectOnViewNodes = root.querySelectorAll<HTMLElement>('[data-effect-trigger="on_view"][data-effect-anim]');
    let effectObserver: IntersectionObserver | null = null;
    if (effectOnViewNodes.length > 0 && !editable) {
      effectObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const anim = (entry.target as HTMLElement).dataset.effectAnim;
              if (anim) (entry.target as HTMLElement).style.animation = anim;
              effectObserver?.unobserve(entry.target);
            }
          }
        },
        { root: null, rootMargin: '0px', threshold: 0.15 },
      );
      for (const node of effectOnViewNodes) effectObserver.observe(node);
    }

    return () => {
      observer?.disconnect();
      effectObserver?.disconnect();
      if (parallaxNodes.length > 0) {
        window.removeEventListener('scroll', applyParallax);
        window.removeEventListener('resize', applyParallax);
      }
    };
  }, [document.components, editable]);

  useEffect(() => {
    if (!editable || !animationPreview) return;
    const root = rootRef.current;
    if (!root) return;
    const node = root.querySelector<HTMLElement>(
      `[data-component-id="${animationPreview.componentId}"]`,
    );
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    let cleanupPreview: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      cleanupPreview = playNodeAnimationPreview(node);
    }, 80);
    return () => {
      window.clearTimeout(timer);
      cleanupPreview?.();
      node.classList.add('is-anim-visible');
      node.classList.remove(
        'is-anim-preview-tap',
        'is-anim-preview-parallax',
        'is-anim-preview-lottie',
        'is-anim-preview-reveal',
      );
    };
  }, [animationPreview, editable]);

  function runAction(action: MobileInteractionAction) {
    if (editable) return;
    if (action.type === 'none') return;
    if (action.type === 'url') {
      const nextUrl = (action.url ?? '').trim();
      if (!nextUrl) return;
      if (openLinksInNewTab) {
        window.open(nextUrl, '_blank', 'noopener,noreferrer');
      } else {
        window.location.assign(nextUrl);
      }
      return;
    }
    if (action.type === 'section') {
      const sectionId = action.sectionId?.trim();
      if (!sectionId) return;
      const target = rootRef.current?.querySelector<HTMLElement>(`[data-component-id="${sectionId}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const modal = action.modal;
    if (!modal) return;
    setActiveModal({
      title: modal.title || 'Informacion',
      body: modal.body || '',
      closeLabel: modal.closeLabel || 'Cerrar',
    });
  }

  return (
    <div
      ref={rootRef}
      className={`mobile-runtime-root${editable ? ' is-editable' : ''}${editable && !onReorder ? ' is-scroll-mode' : ''}${dragActiveId ? ' is-reordering' : ''}`}
      style={{
        backgroundColor: document.theme.backgroundColor,
        color: document.theme.textColor,
        fontFamily: document.theme.fontFamily,
      }}
    >
      {displayComponents.map((component) => {
        const isSelected =
          editable &&
          (selectedIds && selectedIds.length > 0
            ? selectedIds.includes(component.id)
            : selectedId === component.id);
        const isMulti =
          editable && !!selectedIds && selectedIds.length > 1 && selectedIds.includes(component.id);
        return (
        <div
          key={component.id}
          ref={(el) => {
            if (!el) {
              nodeRefs.current.delete(component.id);
              return;
            }
            nodeRefs.current.set(component.id, el);
          }}
          data-component-id={component.id}
          className={[
            'mobile-runtime-node',
            isSelected ? 'is-selected' : '',
            isMulti ? 'is-multi-selected' : '',
            editable ? 'is-anim-visible' : '',
            editable && component.hidden === true ? 'is-hidden-public' : '',
            dragActiveId === component.id ? 'is-dragging' : '',
            effectClassName(component.effect),
          ]
            .filter(Boolean)
            .join(' ')}
          data-anim-preset={component.animation?.preset ?? 'none'}
          data-anim-trigger={component.animation?.trigger ?? 'on_view'}
          data-anim-intensity={component.animation?.intensity ?? 1}
          data-effect-trigger={component.effect?.trigger ?? ''}
          data-effect-anim={buildEffectAnimation(component.effect)}
          style={
            {
              ['--mobile-anim-duration' as string]: `${component.animation?.durationMs ?? 450}ms`,
              ['--mobile-anim-delay' as string]: `${component.animation?.delayMs ?? 0}ms`,
              ['--mobile-intensity' as string]: String(component.animation?.intensity ?? 1),
              ...effectStyle(component.effect),
            } as CSSProperties
          }
          onPointerDown={editable && onReorder ? (e) => onNodePointerDown(component.id, e) : undefined}
          onClick={
            editable && !onReorder
              ? () => onSelect?.(component.id)
              : undefined
          }
          role={editable ? 'button' : undefined}
          tabIndex={editable ? 0 : undefined}
          onKeyDown={
            editable
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect?.(component.id);
                  }
                }
              : undefined
          }
        >
          {editable && onDelete && (
            <button
              type="button"
              className="mobile-runtime-node-delete"
              title="Eliminar componente"
              aria-label="Eliminar componente"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(component.id);
              }}
            >
              ✕
            </button>
          )}
          {component.type === 'accordion' ? (
            <AccordionRuntime
              component={component}
              editable={editable}
              onSelectAccordion={editable ? () => onSelect?.(component.id) : undefined}
              onAction={!editable ? (action) => runAction(action) : undefined}
              onImageClick={!editable ? (src) => setLightboxSrc(src) : undefined}
              onAllergensOpen={!editable ? (payload) => setAllergensModal(payload) : undefined}
            />
          ) : (
            renderComponent(
              component,
              !editable ? (action) => runAction(action) : undefined,
              !editable ? (src) => setLightboxSrc(src) : undefined,
              !editable ? (payload) => setAllergensModal(payload) : undefined,
            )
          )}
        </div>
        );
      })}
      {activeModal && !editable && (
        <div className="mobile-action-modal-overlay" onClick={() => setActiveModal(null)}>
          <div
            className="mobile-action-modal"
            role="dialog"
            aria-modal="true"
            aria-label={activeModal.title}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{activeModal.title}</h3>
            <p>{activeModal.body}</p>
            <button type="button" className="btn-primary" onClick={() => setActiveModal(null)}>
              {activeModal.closeLabel}
            </button>
          </div>
        </div>
      )}
      {allergensModal && (
        <div className="mobile-action-modal-overlay" onClick={() => setAllergensModal(null)}>
          <div
            className="mobile-action-modal mobile-allergens-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Alérgenos de ${allergensModal.dishTitle}`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <h3>Alérgenos</h3>
            <p className="mobile-allergens-dish">{allergensModal.dishTitle}</p>
            <ul className="mobile-allergens-list">
              {allergensModal.allergens.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button type="button" className="btn-primary" onClick={() => setAllergensModal(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
      {lightboxSrc && (
        <div className="mobile-image-lightbox" onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="" onClick={(e) => e.stopPropagation()} />
          <button type="button" className="mobile-image-lightbox-close" onClick={() => setLightboxSrc(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
