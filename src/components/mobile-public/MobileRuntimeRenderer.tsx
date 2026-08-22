import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  defaultMenuItemFieldTypography,
  mobileDropShadowFilter,
  mobileTextShadowCss,
  resolveSectionBgStretchMode,
  resolveSectionBorderStyle,
  resolveSectionMinHeight,
  sectionBgHasHorizontalStretch,
  sectionBgHasVerticalStretch,
  type MobileComponent,
  type MobileEffectConfig,
  type MobileInteractionAction,
  type MobileMenuDocument,
  type MobileTypographyConfig,
} from '@shared/mobile-menu';
import { ensureEditorFontLoaded } from '@/lib/google-fonts';
import { normalizeAssetUrl } from '@/lib/asset-url';
import { AllergenGlyph } from '@/components/mobile-public/AllergenGlyph';

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
    ...textShadowStyle(t),
  };
}

function textShadowStyle(t: MobileTypographyConfig): CSSProperties {
  if (!t.textShadow) return {};
  return {
    textShadow: mobileTextShadowCss(t.textShadowIntensity),
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
    ...textShadowStyle(t),
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

function effectStyle(effect?: MobileEffectConfig, editable = false): CSSProperties {
  if (!effect || effect.type === 'none') return {};
  // En el editor, on_view se reproduce al momento para poder previsualizar.
  if (effect.trigger === 'on_view' && !editable) return {};
  const anim = buildEffectAnimation(effect);
  return anim ? { animation: anim } : {};
}

function effectClassName(effect?: MobileEffectConfig): string {
  if (!effect || effect.type === 'none') return '';
  if (effect.type === 'shimmer') return 'mob-effect-shimmer-bg';
  if (effect.type === 'glow') return 'mob-effect-glow-host';
  return '';
}

function parseDishTagList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\n,;·•]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

type DishInfoKind = 'allergens' | 'ingredients';

type DishInfoPayload = {
  kind: DishInfoKind;
  dishTitle: string;
  items: string[];
  accentColor: string;
};

function AllergenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 2a1 1 0 0 1 .9.55l1.4 2.8 3.1.45a1 1 0 0 1 .55 1.7l-2.25 2.2.53 3.1a1 1 0 0 1-1.45 1.05L12 12.9l-2.78 1.45a1 1 0 0 1-1.45-1.05l.53-3.1-2.25-2.2a1 1 0 0 1 .55-1.7l3.1-.45 1.4-2.8A1 1 0 0 1 12 2zm0 4.2-.7 1.4a1 1 0 0 1-.75.55l-1.55.22 1.12 1.1a1 1 0 0 1 .29.88l-.26 1.55 1.4-.73a1 1 0 0 1 .9 0l1.4.73-.26-1.55a1 1 0 0 1 .29-.88l1.12-1.1-1.55-.22a1 1 0 0 1-.75-.55L12 6.2zM11 15h2v5h-2v-5z"
      />
    </svg>
  );
}

function IngredientIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M17.2 4.3c-3.4.4-6.2 2.2-7.8 4.8-1.2 1.9-1.8 4.1-1.8 6.4 0 1.4.2 2.7.6 3.9l-2.7 2.7 1.4 1.4 2.7-2.7c1.2.4 2.5.6 3.9.6 2.3 0 4.5-.6 6.4-1.8 2.6-1.6 4.4-4.4 4.8-7.8.2-1.7-.3-2.6-1.2-3.5-.9-.9-1.8-1.4-3.5-1.2zM9.2 17.2c-.3-.9-.5-1.8-.5-2.8 0-1.9.5-3.7 1.4-5.2 1.3-2.1 3.5-3.5 6.1-3.8 1.1-.1 1.6.1 2 .5.4.4.6.9.5 2-.3 2.6-1.7 4.8-3.8 6.1-1.5.9-3.3 1.4-5.2 1.4-.9 0-1.8-.2-2.5-.5z"
      />
    </svg>
  );
}

function IngredientGlyph({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path
        fill="currentColor"
        d="M32.4 12.6c-4.1.5-7.5 2.6-9.4 5.8-1.4 2.3-2.2 5-2.2 7.7 0 1.6.2 3.2.7 4.6l-3.4 3.4 1.7 1.7 3.4-3.4c1.4.5 3 .7 4.6.7 2.7 0 5.4-.8 7.7-2.2 3.2-1.9 5.3-5.3 5.8-9.4.2-2-.4-3.1-1.4-4.1s-2.1-1.6-4.1-1.4zm-9.6 15.6c-.4-1-.6-2.1-.6-3.3 0-2.3.6-4.4 1.7-6.2 1.5-2.5 4.2-4.2 7.3-4.6 1.3-.2 1.9.1 2.4.6s.8 1.1.6 2.4c-.4 3.1-2.1 5.8-4.6 7.3-1.8 1.1-3.9 1.7-6.2 1.7-1.1 0-2.2-.2-3-.5z"
      />
    </svg>
  );
}

function DishInfoChip({
  label,
  ariaLabel,
  accentColor,
  icon,
  onOpen,
}: {
  label: string;
  ariaLabel: string;
  accentColor: string;
  icon: ReactNode;
  onOpen?: () => void;
}) {
  const style = {
    '--allergens-accent': accentColor,
  } as CSSProperties;
  const content = (
    <>
      {icon}
      <span>{label}</span>
    </>
  );
  if (onOpen) {
    return (
      <button
        type="button"
        className="mobile-menu-allergens-btn"
        title={label}
        aria-label={ariaLabel}
        style={style}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        {content}
      </button>
    );
  }
  return (
    <span className="mobile-menu-allergens-btn" aria-hidden="true" style={style}>
      {content}
    </span>
  );
}

function TrashIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v10h-2V9zm4 0h2v10h-2V9zM7 9h2v10H7V9z"
      />
    </svg>
  );
}

/** Asa de reordenado (≡) — visible solo en modo Mover. */
function ReorderHandleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M4 7h16v2.2H4V7zm0 4.4h16v2.2H4v-2.2zm0 4.4h16V18H4v-2.2z"
      />
    </svg>
  );
}

const SWIPE_ACTION_WIDTH = 96;
const SWIPE_OPEN_THRESHOLD = 40;
const SWIPE_AXIS_LOCK_PX = 10;

function SectionBackgroundImage({
  image,
}: {
  image?: {
    src: string;
    align: 'left' | 'center' | 'right';
    stretch?: boolean;
    stretchMode?: 'none' | 'cover' | 'horizontal' | 'vertical' | 'both';
  };
}) {
  const src = normalizeAssetUrl(image?.src?.trim());
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [axisTransform, setAxisTransform] = useState('none');

  const align = image?.align === 'left' || image?.align === 'right' ? image.align : 'center';
  const stretchMode = resolveSectionBgStretchMode(image);
  const stretchH = sectionBgHasHorizontalStretch(stretchMode) && stretchMode !== 'cover';
  const stretchV = sectionBgHasVerticalStretch(stretchMode) && stretchMode !== 'cover';
  const isAxisStretch = stretchH || stretchV;

  useLayoutEffect(() => {
    if (!isAxisStretch || !src) {
      setAxisTransform('none');
      return;
    }

    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img) return;

    const update = () => {
      const cw = frame.clientWidth;
      const ch = frame.clientHeight;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      if (!cw || !ch || !iw || !ih) return;

      // Base: contain. Cada eje activo estira desde el centro hasta llenar ese eje.
      const contain = Math.min(cw / iw, ch / ih);
      const drawnW = iw * contain;
      const drawnH = ih * contain;
      const fillX = drawnW > 0 ? cw / drawnW : 1;
      const fillY = drawnH > 0 ? ch / drawnH : 1;

      const sx = stretchH ? fillX : 1;
      const sy = stretchV ? fillY : 1;
      setAxisTransform(`scale(${sx}, ${sy})`);
    };

    const onLoad = () => update();
    if (img.complete && img.naturalWidth > 0) update();
    else img.addEventListener('load', onLoad);

    const ro = new ResizeObserver(update);
    ro.observe(frame);

    return () => {
      img.removeEventListener('load', onLoad);
      ro.disconnect();
    };
  }, [isAxisStretch, stretchH, stretchV, src]);

  if (!src) return null;

  if (isAxisStretch) {
    const objectPosition =
      align === 'left' ? 'left center' : align === 'right' ? 'right center' : 'center center';
    return (
      <div ref={frameRef} className="mobile-section-bg-frame" aria-hidden="true">
        <img
          ref={imgRef}
          className="mobile-section-bg-axis"
          src={src}
          alt=""
          draggable={false}
          decoding="async"
          style={{
            objectPosition,
            transform: axisTransform,
          }}
        />
      </div>
    );
  }

  return (
    <img
      className={`mobile-section-bg align-${align}${stretchMode === 'cover' ? ' is-stretch' : ''}`}
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
  onDishInfoOpen?: (payload: DishInfoPayload) => void,
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
          src={normalizeAssetUrl(component.src)}
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
      const allergenItems = parseDishTagList(component.allergens);
      const ingredientItems = parseDishTagList(component.ingredients);
      const ingredientsAccent = component.ingredientsAccentColor?.trim() || '#4d7c0f';
      const allergensAccent = component.allergensAccentColor?.trim() || '#b45309';
      const dishTitle = component.title || 'Plato';
      return (
        <article
          className={`mobile-block mobile-block-menu-item${
            hasMenuImage ? ` has-image image-${imagePosition}` : ''
          }`}
          style={{
            backgroundColor: component.backgroundColor?.trim() || '#ffffff',
          }}
        >
          {hasMenuImage && (
            <img
              className="mobile-menu-item-thumb"
              src={normalizeAssetUrl(component.menuImage!.src)}
              alt={component.menuImage?.alt || 'Imagen del plato'}
              style={{
                width: `${component.menuImage?.width ?? 92}px`,
                borderRadius: `${component.menuImage?.radius ?? 10}px`,
                cursor: onImageClick ? 'pointer' : undefined,
              }}
              loading="lazy"
              decoding="async"
              draggable={false}
              onClick={
                onImageClick
                  ? () => onImageClick(normalizeAssetUrl(component.menuImage!.src))
                  : undefined
              }
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
            {component.ingredientsDisplay !== 'button' && component.ingredients.trim() ? (
              <small
                className="mobile-menu-ingredients"
                style={menuItemTypographyStyle(component, 'ingredients')}
              >
                {component.ingredients}
              </small>
            ) : null}
            {((component.ingredientsDisplay === 'button' && ingredientItems.length > 0) ||
              allergenItems.length > 0) && (
              <div className="mobile-menu-meta-actions">
                {component.ingredientsDisplay === 'button' && ingredientItems.length > 0 && (
                  <DishInfoChip
                    label="Ingredientes"
                    ariaLabel={`Ingredientes de ${dishTitle}`}
                    accentColor={ingredientsAccent}
                    icon={<IngredientIcon />}
                    onOpen={
                      onDishInfoOpen
                        ? () =>
                            onDishInfoOpen({
                              kind: 'ingredients',
                              dishTitle,
                              items: ingredientItems,
                              accentColor: ingredientsAccent,
                            })
                        : undefined
                    }
                  />
                )}
                {allergenItems.length > 0 && (
                  <DishInfoChip
                    label="Alérgenos"
                    ariaLabel={`Alérgenos de ${dishTitle}`}
                    accentColor={allergensAccent}
                    icon={<AllergenIcon />}
                    onOpen={
                      onDishInfoOpen
                        ? () =>
                            onDishInfoOpen({
                              kind: 'allergens',
                              dishTitle,
                              items: allergenItems,
                              accentColor: allergensAccent,
                            })
                        : undefined
                    }
                  />
                )}
              </div>
            )}
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

type AnimationPreviewPlay = {
  componentId: string;
  nonce: number;
  className: string;
  revealVisible: boolean;
};

function animationStyleVars(component: MobileComponent): CSSProperties {
  return {
    ['--mobile-anim-duration' as string]: `${component.animation?.durationMs ?? 450}ms`,
    ['--mobile-anim-delay' as string]: `${component.animation?.delayMs ?? 0}ms`,
    ['--mobile-intensity' as string]: String(component.animation?.intensity ?? 1),
  };
}

function previewVisibilityClasses(
  componentId: string,
  previewPlay: AnimationPreviewPlay | null,
  editable: boolean,
): string[] {
  const isTarget = previewPlay?.componentId === componentId;
  const classes: string[] = [];
  if (isTarget && previewPlay.className) classes.push(previewPlay.className);
  const revealPreview = isTarget && previewPlay.className === 'is-anim-preview-reveal';
  if (revealPreview) {
    if (previewPlay.revealVisible) classes.push('is-anim-visible');
  } else if (editable) {
    classes.push('is-anim-visible');
  }
  return classes;
}

function resolvePreviewClassName(preset: string, trigger: string): string | null {
  if (preset === 'none') return null;
  if (trigger === 'on_tap' || preset === 'tap') return 'is-anim-preview-tap';
  if (preset === 'reveal') return 'is-anim-preview-reveal';
  if (preset === 'parallax') return 'is-anim-preview-parallax';
  if (preset === 'lottie') return 'is-anim-preview-lottie';
  return null;
}

function AccordionRuntime({
  component,
  editable,
  selectedId,
  onSelectAccordion,
  onSelectChild,
  onAction,
  onImageClick,
  onDishInfoOpen,
  previewPlay,
  animationPreview,
  registerNodeRef,
}: {
  component: Extract<MobileComponent, { type: 'accordion' }>;
  editable?: boolean;
  selectedId?: string | null;
  onSelectAccordion?: () => void;
  onSelectChild?: (id: string) => void;
  onAction?: (action: MobileInteractionAction) => void;
  onImageClick?: (src: string) => void;
  onDishInfoOpen?: (payload: DishInfoPayload) => void;
  previewPlay?: AnimationPreviewPlay | null;
  animationPreview?: { componentId: string; nonce: number } | null;
  registerNodeRef?: (id: string, el: HTMLDivElement | null) => void;
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
  const chevronAnimation =
    component.chevronAnimation === 'rotate' || !component.chevronAnimation
      ? 'none'
      : component.chevronAnimation;
  const chevronDirection = component.chevronDirection === 'right' ? 'right' : 'down';
  const chevronShadowStyle: CSSProperties =
    component.chevronShadow === true
      ? { filter: mobileDropShadowFilter(component.chevronShadowIntensity) }
      : {};
  const headerIsSection = header?.type === 'section';
  const selectedBodyChildId =
    editable && selectedId && body.some((child) => child.id === selectedId) ? selectedId : null;

  // Si se selecciona un hijo del cuerpo, abrir el acordeón para verlo/editarlo.
  useEffect(() => {
    if (selectedBodyChildId) setOpen(true);
  }, [selectedBodyChildId]);

  // Abrir el panel antes del preview si el objetivo es un hijo.
  useEffect(() => {
    const targetId = animationPreview?.componentId ?? previewPlay?.componentId;
    if (!targetId) return;
    if (component.children.some((child, index) => index > 0 && child.id === targetId)) {
      setOpen(true);
    }
  }, [animationPreview, previewPlay, component.children]);

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
                !editable ? onDishInfoOpen : undefined,
              )
            : null}
        </div>
        {showChevron && (
          <span
            className={`mobile-accordion-chevron mobile-accordion-chevron--dir-${chevronDirection} mobile-accordion-chevron--${chevronAnimation}${
              open ? ' is-open' : ''
            }`}
            aria-hidden="true"
            style={{ color: chevronColor, ...chevronShadowStyle }}
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
        {body.map((child) => {
          const isChildSelected = editable && selectedId === child.id;
          const childPreviewClasses = previewVisibilityClasses(
            child.id,
            previewPlay ?? null,
            !!editable,
          );
          return (
            <div
              key={child.id}
              ref={(el) => registerNodeRef?.(child.id, el)}
              className={[
                'mobile-accordion-child',
                'mobile-runtime-node',
                isChildSelected ? 'is-selected' : '',
                editable && child.hidden === true ? 'is-hidden-public' : '',
                ...childPreviewClasses,
              ]
                .filter(Boolean)
                .join(' ')}
              data-component-id={child.id}
              data-accordion-child-id={child.id}
              data-anim-preset={child.animation?.preset ?? 'none'}
              data-anim-trigger={child.animation?.trigger ?? 'on_view'}
              data-anim-intensity={child.animation?.intensity ?? 1}
              style={animationStyleVars(child)}
              role={editable ? 'button' : undefined}
              tabIndex={editable ? 0 : undefined}
              onClick={
                editable
                  ? (e) => {
                      e.stopPropagation();
                      onSelectChild?.(child.id);
                    }
                  : undefined
              }
              onPointerDown={
                editable
                  ? (e) => {
                      // Evita que el drag del acordeón padre capture el toque del hijo.
                      e.stopPropagation();
                    }
                  : undefined
              }
              onKeyDown={
                editable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelectChild?.(child.id);
                      }
                    }
                  : undefined
              }
            >
              {renderComponent(
                child,
                !editable ? onAction : undefined,
                !editable ? onImageClick : undefined,
                !editable ? onDishInfoOpen : undefined,
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const [dishInfoModal, setDishInfoModal] = useState<DishInfoPayload | null>(null);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [dragOrderIds, setDragOrderIds] = useState<string[] | null>(null);
  const [previewPlay, setPreviewPlay] = useState<AnimationPreviewPlay | null>(null);
  /** Componente con la acción Eliminar revelada (swipe iOS). */
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  /** Offset en vivo mientras se arrastra el swipe. */
  const [swipeOffset, setSwipeOffset] = useState<{ id: string; x: number } | null>(null);

  const dragActiveIdRef = useRef<string | null>(null);
  const dragOrderIdsRef = useRef<string[] | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; id: string } | null>(null);
  const dragMovedRef = useRef(false);
  const dragFrameRef = useRef<number | null>(null);
  const listeningRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressArmedRef = useRef(false);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevPosRef = useRef<Map<string, number>>(new Map());
  const componentIdsRef = useRef<string[]>(document.components.map((c) => c.id));
  const onReorderRef = useRef(onReorder);
  const onSelectRef = useRef(onSelect);
  const onDeleteRef = useRef(onDelete);
  const swipeOpenIdRef = useRef<string | null>(null);
  const swipeSessionRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    startOffset: number;
    mode: 'pending' | 'horizontal' | 'cancelled';
  } | null>(null);
  const swipeListeningRef = useRef(false);
  const swipeMovedRef = useRef(false);
  componentIdsRef.current = document.components.map((c) => c.id);
  onReorderRef.current = onReorder;
  onSelectRef.current = onSelect;
  onDeleteRef.current = onDelete;
  swipeOpenIdRef.current = swipeOpenId;

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

  function closeSwipe() {
    swipeOpenIdRef.current = null;
    setSwipeOpenId(null);
    setSwipeOffset(null);
  }

  function snapSwipe(id: string, offset: number) {
    const open = offset <= -SWIPE_OPEN_THRESHOLD;
    if (open) {
      swipeOpenIdRef.current = id;
      setSwipeOpenId(id);
      setSwipeOffset(null);
    } else {
      closeSwipe();
    }
  }

  function removeSwipeListeners() {
    if (!swipeListeningRef.current) return;
    swipeListeningRef.current = false;
    window.removeEventListener('pointermove', stableSwipeMove);
    window.removeEventListener('pointerup', stableSwipeUp);
    window.removeEventListener('pointercancel', stableSwipeCancel);
  }

  function endSwipeSession(commit: boolean) {
    const session = swipeSessionRef.current;
    swipeSessionRef.current = null;
    removeSwipeListeners();
    if (!session || session.mode === 'cancelled') {
      setSwipeOffset(null);
      return;
    }
    if (!commit || session.mode !== 'horizontal') {
      // Tap sin swipe horizontal: cerrar si estaba abierto otro / mismo.
      if (!swipeMovedRef.current) {
        if (swipeOpenIdRef.current && swipeOpenIdRef.current !== session.id) {
          closeSwipe();
        } else if (swipeOpenIdRef.current === session.id) {
          closeSwipe();
        }
        onSelectRef.current?.(session.id);
      } else {
        setSwipeOffset(null);
      }
      swipeMovedRef.current = false;
      return;
    }
    const live = swipeOffsetLiveRef.current;
    snapSwipe(session.id, live);
    swipeMovedRef.current = false;
  }

  const swipeOffsetLiveRef = useRef(0);

  function beginSwipeSession(
    id: string,
    pointerId: number,
    startX: number,
    startY: number,
    startOffset: number,
    mode: 'pending' | 'horizontal' = 'pending',
  ) {
    removeSwipeListeners();
    swipeMovedRef.current = mode === 'horizontal';
    swipeOffsetLiveRef.current = startOffset;
    swipeSessionRef.current = {
      id,
      pointerId,
      startX,
      startY,
      startOffset,
      mode,
    };
    if (mode === 'horizontal') {
      setSwipeOffset({ id, x: startOffset });
      if (swipeOpenIdRef.current && swipeOpenIdRef.current !== id) {
        swipeOpenIdRef.current = null;
        setSwipeOpenId(null);
      }
    }
    swipeListeningRef.current = true;
    window.addEventListener('pointermove', stableSwipeMove, { passive: false });
    window.addEventListener('pointerup', stableSwipeUp);
    window.addEventListener('pointercancel', stableSwipeCancel);
  }

  const onSwipeMoveRef = useRef<(e: PointerEvent) => void>(() => undefined);
  const onSwipeUpRef = useRef<(e: PointerEvent) => void>(() => undefined);
  const onSwipeCancelRef = useRef<(e: PointerEvent) => void>(() => undefined);

  const stableSwipeMove = useRef((e: PointerEvent) => {
    onSwipeMoveRef.current(e);
  }).current;
  const stableSwipeUp = useRef((e: PointerEvent) => {
    onSwipeUpRef.current(e);
  }).current;
  const stableSwipeCancel = useRef((e: PointerEvent) => {
    onSwipeCancelRef.current(e);
  }).current;

  onSwipeMoveRef.current = (e: PointerEvent) => {
    const session = swipeSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;
    const dx = e.clientX - session.startX;
    const dy = e.clientY - session.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (session.mode === 'pending') {
      if (absY > SWIPE_AXIS_LOCK_PX && absY > absX) {
        session.mode = 'cancelled';
        endSwipeSession(false);
        return;
      }
      if (absX > SWIPE_AXIS_LOCK_PX && absX > absY) {
        session.mode = 'horizontal';
        swipeMovedRef.current = true;
        if (swipeOpenIdRef.current && swipeOpenIdRef.current !== session.id) {
          swipeOpenIdRef.current = null;
          setSwipeOpenId(null);
        }
        try {
          e.preventDefault();
        } catch {
          /* ignore */
        }
      } else {
        return;
      }
    }

    if (session.mode !== 'horizontal') return;
    try {
      e.preventDefault();
    } catch {
      /* ignore */
    }
    const next = Math.max(-SWIPE_ACTION_WIDTH, Math.min(0, session.startOffset + dx));
    swipeOffsetLiveRef.current = next;
    setSwipeOffset({ id: session.id, x: next });
  };

  onSwipeUpRef.current = (e: PointerEvent) => {
    const session = swipeSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;
    endSwipeSession(true);
  };

  onSwipeCancelRef.current = (e: PointerEvent) => {
    const session = swipeSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;
    endSwipeSession(false);
  };

  function armLongPressDrag(id: string) {
    if (longPressArmedRef.current) return;
    closeSwipe();
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
      // Desde el asa: armar al mover un poco (sin long-press ni swipe).
      if (dist < 4) return;
      armLongPressDrag(start.id);
      dragMovedRef.current = true;
    } else if (!dragMovedRef.current) {
      if (dist < 4) return;
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

  /** Reordenado solo desde el asa ≡ (modo Mover). */
  function onReorderHandlePointerDown(id: string, e: ReactPointerEvent<HTMLButtonElement>) {
    if (!editable || !onReorder) return;
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();
    closeSwipe();
    removeDragListeners();
    clearLongPressTimer();
    dragPointerIdRef.current = e.pointerId;
    dragStartRef.current = { x: e.clientX, y: e.clientY, id };
    dragMovedRef.current = false;
    longPressArmedRef.current = false;
    listeningRef.current = true;
    window.addEventListener('pointermove', stableMove, { passive: true });
    window.addEventListener('pointerup', stableUp);
    window.addEventListener('pointercancel', stableCancel);
    // Intención clara: armar al instante desde el asa.
    armLongPressDrag(id);
  }

  function onSwipePointerDown(id: string, e: ReactPointerEvent<HTMLDivElement>) {
    if (!editable || !onDelete) return;
    // En modo Mover no hay swipe; solo asas.
    if (onReorder) return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('a, button, input, textarea, select, [contenteditable="true"]')) return;
    if (target?.closest('.mobile-runtime-swipe-action')) return;
    if (target?.closest('.mobile-runtime-reorder-handle')) return;

    const startOffset = swipeOpenIdRef.current === id ? -SWIPE_ACTION_WIDTH : 0;
    beginSwipeSession(id, e.pointerId, e.clientX, e.clientY, startOffset, 'pending');
  }

  function resolveSwipeTranslateX(id: string): number {
    if (swipeOffset?.id === id) return swipeOffset.x;
    if (swipeOpenId === id) return -SWIPE_ACTION_WIDTH;
    return 0;
  }

  useEffect(() => {
    if (onReorder) closeSwipe();
  }, [onReorder]);

  useEffect(() => {
    if (!dragActiveId || !dragOrderIds) return;
    animateFlip();
    capturePositions();
  }, [dragOrderIds, dragActiveId]);

  useEffect(
    () => () => {
      clearLongPressTimer();
      removeDragListeners();
      removeSwipeListeners();
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
    let revealFallbackTimer = 0;
    if (revealNodes.length > 0) {
      const revealIfVisible = (node: HTMLElement) => {
        const rect = node.getBoundingClientRect();
        const vh = window.innerHeight || 0;
        const vw = window.innerWidth || 0;
        const visible =
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < vh &&
          rect.left < vw &&
          rect.height > 0;
        if (visible) node.classList.add('is-anim-visible');
        return visible;
      };

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-anim-visible');
              observer?.unobserve(entry.target);
            }
          }
        },
        { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
      );
      for (const node of revealNodes) {
        if (node.dataset.animTrigger === 'on_load') continue;
        // Primer paint: revelar ya visibles (evita carta en blanco en WebViews).
        if (revealIfVisible(node)) continue;
        observer.observe(node);
      }

      revealFallbackTimer = window.setTimeout(() => {
        for (const node of revealNodes) {
          if (!node.classList.contains('is-anim-visible')) {
            node.classList.add('is-anim-visible');
          }
        }
      }, 900);
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
        { root: null, rootMargin: '0px', threshold: 0.05 },
      );
      for (const node of effectOnViewNodes) effectObserver.observe(node);
    }

    return () => {
      if (revealFallbackTimer) window.clearTimeout(revealFallbackTimer);
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

    const componentId = animationPreview.componentId;
    const nonce = animationPreview.nonce;

    const findNode = () =>
      nodeRefs.current.get(componentId) ??
      root.querySelector<HTMLElement>(`[data-component-id="${componentId}"]`);

    // Esperar un frame por si el acordeón debe abrirse al montar el hijo.
    let delayTimer = 0;
    let revealTimer = 0;
    let endTimer = 0;
    const startTimer = window.setTimeout(() => {
      const node = findNode();
      if (!node) return;

      const preset = node.dataset.animPreset ?? 'none';
      const trigger = node.dataset.animTrigger ?? 'on_view';
      const previewClass = resolvePreviewClassName(preset, trigger);
      if (!previewClass) return;

      const durationRaw = node.style.getPropertyValue('--mobile-anim-duration') || '450';
      const delayRaw = node.style.getPropertyValue('--mobile-anim-delay') || '0';
      const durationMs = Number.parseInt(durationRaw, 10) || 450;
      const delayMs = Number.parseInt(delayRaw, 10) || 0;

      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setPreviewPlay({
        componentId,
        nonce,
        className: previewClass,
        revealVisible: false,
      });

      if (previewClass === 'is-anim-preview-reveal') {
        revealTimer = window.setTimeout(() => {
          setPreviewPlay((current) =>
            current && current.nonce === nonce ? { ...current, revealVisible: true } : current,
          );
        }, Math.max(40, delayMs));
        endTimer = window.setTimeout(
          () => {
            setPreviewPlay((current) => (current && current.nonce === nonce ? null : current));
          },
          Math.max(40, delayMs) + Math.max(durationMs, 300) + 80,
        );
      } else {
        const holdMs =
          previewClass === 'is-anim-preview-parallax' || previewClass === 'is-anim-preview-lottie'
            ? Math.max(700, durationMs * 2)
            : Math.max(220, durationMs);
        endTimer = window.setTimeout(() => {
          setPreviewPlay((current) => (current && current.nonce === nonce ? null : current));
        }, holdMs + Math.max(0, delayMs));
      }
    }, 80);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(delayTimer);
      window.clearTimeout(revealTimer);
      window.clearTimeout(endTimer);
      setPreviewPlay((current) => (current && current.nonce === nonce ? null : current));
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
        ['--mobile-swipe-front-bg' as string]: document.theme.backgroundColor || '#ffffff',
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
        const swipeX = editable && onDelete ? resolveSwipeTranslateX(component.id) : 0;
        const swipeOpen = editable && onDelete && swipeOpenId === component.id && !swipeOffset;
        const nodeBody = (
          <>
            {component.type === 'accordion' ? (
              <AccordionRuntime
                component={component}
                editable={editable}
                selectedId={selectedId}
                onSelectAccordion={editable ? () => onSelect?.(component.id) : undefined}
                onSelectChild={editable ? (id) => onSelect?.(id) : undefined}
                onAction={!editable ? (action) => runAction(action) : undefined}
                onImageClick={!editable ? (src) => setLightboxSrc(src) : undefined}
                onDishInfoOpen={!editable ? (payload) => setDishInfoModal(payload) : undefined}
                previewPlay={previewPlay}
                animationPreview={animationPreview}
                registerNodeRef={(id, el) => {
                  if (!el) {
                    nodeRefs.current.delete(id);
                    return;
                  }
                  nodeRefs.current.set(id, el);
                }}
              />
            ) : (
              renderComponent(
                component,
                !editable ? (action) => runAction(action) : undefined,
                !editable ? (src) => setLightboxSrc(src) : undefined,
                !editable ? (payload) => setDishInfoModal(payload) : undefined,
              )
            )}
          </>
        );

        if (editable && onDelete) {
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
                'mobile-runtime-swipe-row',
                'mobile-runtime-node',
                isSelected ? 'is-selected' : '',
                isMulti ? 'is-multi-selected' : '',
                ...previewVisibilityClasses(component.id, previewPlay, editable),
                component.hidden === true ? 'is-hidden-public' : '',
                dragActiveId === component.id ? 'is-dragging' : '',
                swipeOpen || (swipeOffset?.id === component.id && swipeOffset.x < -8)
                  ? 'is-swipe-open'
                  : '',
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
                  ...animationStyleVars(component),
                  ...effectStyle(component.effect, editable),
                } as CSSProperties
              }
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect?.(component.id);
                }
              }}
            >
              <div className="mobile-runtime-swipe-actions" aria-hidden={swipeX > -SWIPE_OPEN_THRESHOLD}>
                <button
                  type="button"
                  className="mobile-runtime-swipe-action"
                  title="Eliminar componente"
                  aria-label="Eliminar componente"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeSwipe();
                    onDelete(component.id);
                  }}
                >
                  <TrashIcon size={20} />
                  <span>Eliminar</span>
                </button>
              </div>
              <div
                className="mobile-runtime-swipe-front"
                style={{
                  transform: `translateX(${swipeX}px)`,
                  transition: swipeOffset?.id === component.id ? 'none' : undefined,
                }}
                onPointerDown={(e) => {
                  if (onReorder) return;
                  onSwipePointerDown(component.id, e);
                }}
                onClick={
                  onReorder
                    ? () => {
                        onSelect?.(component.id);
                      }
                    : undefined
                }
              >
                {onReorder && (
                  <button
                    type="button"
                    className="mobile-runtime-reorder-handle"
                    title="Arrastrar para reordenar"
                    aria-label="Arrastrar para reordenar"
                    onPointerDown={(e) => onReorderHandlePointerDown(component.id, e)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ReorderHandleIcon size={18} />
                  </button>
                )}
                <div className="mobile-runtime-swipe-front-body">{nodeBody}</div>
              </div>
            </div>
          );
        }

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
            ...previewVisibilityClasses(component.id, previewPlay, editable),
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
              ...animationStyleVars(component),
              ...effectStyle(component.effect, editable),
            } as CSSProperties
          }
          onPointerDown={undefined}
          onClick={
            editable && !onReorder
              ? () => onSelect?.(component.id)
              : editable && onReorder
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
          {nodeBody}
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
      {dishInfoModal && (
        <div className="mobile-action-modal-overlay mobile-allergens-overlay" onClick={() => setDishInfoModal(null)}>
          <div
            className="mobile-action-modal mobile-allergens-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-allergens-dish-title"
            style={
              {
                '--allergens-accent': dishInfoModal.accentColor || '#b45309',
              } as CSSProperties
            }
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="mobile-allergens-close"
              aria-label="Cerrar"
              onClick={() => setDishInfoModal(null)}
            >
              ✕
            </button>
            <h2 id="mobile-allergens-dish-title" className="mobile-allergens-dish-title">
              {dishInfoModal.dishTitle || 'Plato'}
            </h2>
            <p className="mobile-allergens-heading">
              {dishInfoModal.kind === 'ingredients' ? 'Ingredientes' : 'Alérgenos'}
            </p>
            <ul className="mobile-allergens-list">
              {dishInfoModal.items.map((item, index) => (
                <li key={`${item}-${index}`}>
                  <span className="mobile-allergens-icon" aria-hidden="true">
                    {dishInfoModal.kind === 'ingredients' ? (
                      <IngredientGlyph size={32} />
                    ) : (
                      <AllergenGlyph name={item} size={32} />
                    )}
                  </span>
                  <span className="mobile-allergens-label">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {lightboxSrc && (
        <div className="mobile-image-lightbox" onClick={() => setLightboxSrc(null)}>
          <img src={normalizeAssetUrl(lightboxSrc)} alt="" onClick={(e) => e.stopPropagation()} />
          <button type="button" className="mobile-image-lightbox-close" onClick={() => setLightboxSrc(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
