import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { MobileRuntimeRenderer } from '@/components/mobile-public/MobileRuntimeRenderer';
import { MobileImportOcrModal, type MobileOcrImportSource } from '@/components/mobile-public/MobileImportOcrModal';
import type { ImportMenuOptions } from '@/components/editor/ImportMenuModal';
import { StockImageSearch } from '@/components/editor/StockImageSearch';
import { AssetManagerModal } from '@/components/editor/AssetManagerModal';
import { PublishQrModal } from '@/components/editor/PublishQrModal';
import type { CanvasInteractionMode } from '@/components/editor/EditorZoomControls';
import { appConfirm } from '@/lib/app-dialog';
import {
  countMobileOcrMenuItems,
  menuOcrResultToMobileComponents,
} from '@/lib/ocr-to-mobile-menu';
import { prepareImageForVisionOcr } from '@/lib/vision-menu-import';
import { ensureEditorFontLoaded } from '@/lib/google-fonts';
import { renderMobileDocumentThumbnail } from '@/lib/menu-thumbnail';
import {
  ApiError,
  deleteAsset,
  getMenu,
  importStockImage,
  recognizeMenuWithVision,
  updateMenu,
  uploadAsset,
} from '@/lib/api';
import { compressImage } from '@/lib/image-compress';
import type { StockImage } from '@shared/stock';
import {
  MOBILE_COMPONENT_LIBRARY,
  MOBILE_DEVICE_PRESETS,
  MOBILE_SECTION_SIZE_OPTIONS,
  MOBILE_SECTION_BORDER_LINE_OPTIONS,
  MOBILE_SECTION_BORDER_ROUND_OPTIONS,
  COMMON_ALLERGENS,
  createDefaultMobileComponent,
  createDefaultMobileMenuDocument,
  defaultMenuItemFieldTypography,
  isAllergenSelected,
  normalizeMobileMenuDocument,
  toggleAllergenTag,
  findMobileComponentById,
  updateMobileComponentById,
  removeMobileComponentById,
  createAccordionFromTopLevelIds,
  ungroupAccordionById,
  areTopLevelIdsConsecutive,
  type MobileAnimationConfig,
  type MobileAnimationPreset,
  type MobileAnimationTrigger,
  type MobileEffectConfig,
  type MobileEffectType,
  type MobileEffectRepeat,
  type MobileEffectTrigger,
  type DevicePresetId,
  type MobileInteractionAction,
  type MobileInteractionActionType,
  type MobileMenuDocument,
  type MobileSectionBorderLine,
  type MobileSectionBorderRound,
  type MobileSectionSize,
  type MobileTypographyConfig,
} from '@shared/mobile-menu';

function AlignLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M3 6h14v2H3V6zm0 4h18v2H3v-2zm0 4h12v2H3v-2zm0 4h18v2H3v-2z" />
    </svg>
  );
}

function AlignCenterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M5 6h14v2H5V6zm-2 4h18v2H3v-2zm3 4h12v2H6v-2zm-3 4h18v2H3v-2z" />
    </svg>
  );
}

function AlignRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M7 6h14v2H7V6zM3 10h18v2H3v-2zm9 4h9v2h-9v-2zM3 18h18v2H3v-2z" />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M10 4v3h2.21l-3.42 10H6v3h8v-3h-2.21l3.42-10H18V4h-8z" />
    </svg>
  );
}

function UnderlineIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"
      />
    </svg>
  );
}

function StrikethroughIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10.5 7.5C10.5 6.12 11.62 5 13 5c1.1 0 2 .9 2 2h2.5C17.5 4.57 15.54 3 13 3c-2.76 0-5 2.24-5 5 0 .5.08.97.22 1.41H3v2h18v-2h-5.05c.03-.16.05-.33.05-.5 0-1.38-1.12-2.5-2.5-2.5-.83 0-1.5.67-1.5 1.5v.09zM13 15.5c1.38 0 2.5 1.12 2.5 2.5s-1.12 2.5-2.5 2.5c-1.1 0-2-.9-2-2H8.5c0 2.43 1.96 4 4.5 4 2.76 0 5-2.24 5-5 0-.55-.1-1.07-.27-1.55H3.5v-2H21v2h-8z"
      />
    </svg>
  );
}

function UppercaseIcon() {
  return <span className="wysiwyg-text-icon" aria-hidden="true">AA</span>;
}

function LowercaseIcon() {
  return <span className="wysiwyg-text-icon" aria-hidden="true">aa</span>;
}

function CapitalizeIcon() {
  return <span className="wysiwyg-text-icon" aria-hidden="true">Aa</span>;
}

function MoveModeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M13 5.83 15.17 8l1.41-1.41L12 2 7.41 6.59 8.83 8 11 5.83V11H5.83L8 8.83 6.59 7.41 2 12l4.59 4.59L8 15.17 5.83 13H11v5.17L8.83 16l-1.41 1.41L12 22l4.59-4.59L15.17 16 13 18.17V13h5.17L16 15.17l1.41 1.41L22 12l-4.59-4.59L16 8.83 18.17 11H13V5.83z"
      />
    </svg>
  );
}

function ScrollModeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3.5 8.5 7h2.25v3.5h2.5V7H15.5L12 3.5zm0 17L15.5 17h-2.25v-3.5h-2.5V17H8.5L12 20.5zM4 11h16v2H4v-2z"
      />
    </svg>
  );
}

function BulletListIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <circle cx="5" cy="7" r="1.6" fill="currentColor" />
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="5" cy="17" r="1.6" fill="currentColor" />
      <path fill="currentColor" d="M9 6h11v2H9V6zm0 5h11v2H9v-2zm0 5h11v2H9v-2z" />
    </svg>
  );
}

function NumberListIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 5h1.6v1.1H4.7V7h.9v1.1H4V5zm0 5.2h2.2v.9H5.1l1.1 1.6v.8H4v-.9h1.1L4 12.1v-.9zm.1 4.5h1.2v.4c0 .3-.1.5-.4.5s-.4-.2-.4-.5H3.2c0 1 .7 1.6 1.7 1.6s1.7-.7 1.7-1.6v-.4c0-.7-.4-1.1-1.1-1.2.5-.1.9-.5.9-1.1 0-.8-.6-1.4-1.5-1.4S3.2 12.9 3.2 13.7h1.2c0-.3.2-.5.5-.5s.4.2.4.5-.2.5-.5.5H4.1v.9zm5.9-9.5h11v2H10V5.2zm0 5h11v2H10v-2zm0 5h11v2H10v-2z"
      />
    </svg>
  );
}

function IndentIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M3 5h18v2H3V5zm8 4h10v2H11V9zm0 4h10v2H11v-2zM3 17h18v2H3v-2z" />
      <path fill="currentColor" d="M3 10.5h5v3H3v-3zm5 1.5L5 9.5v5L8 12z" />
    </svg>
  );
}

function OutdentIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M3 5h18v2H3V5zm8 4h10v2H11V9zm0 4h10v2H11v-2zM3 17h18v2H3v-2z" />
      <path fill="currentColor" d="M8 10.5H3v3h5v-3zM3 12l3 2.5v-5L3 12z" />
    </svg>
  );
}

function TypographyStyleToolbar({
  fontStyle,
  textDecoration,
  textTransform,
  onChange,
  listStyle,
  onListStyleChange,
}: {
  fontStyle: MobileTypographyConfig['fontStyle'];
  textDecoration: MobileTypographyConfig['textDecoration'];
  textTransform: MobileTypographyConfig['textTransform'];
  onChange: (patch: Partial<MobileTypographyConfig>) => void;
  listStyle?: 'none' | 'bullet' | 'number';
  onListStyleChange?: (next: 'none' | 'bullet' | 'number') => void;
}) {
  const currentList = listStyle ?? 'none';
  return (
    <>
      <label>
        Formato
        <div className="wysiwyg-align-group" role="group" aria-label="Formato de texto">
          <button
            type="button"
            className={fontStyle === 'italic' ? 'is-active' : undefined}
            onClick={() => onChange({ fontStyle: fontStyle === 'italic' ? 'normal' : 'italic' })}
            title="Cursiva"
            aria-label="Cursiva"
            aria-pressed={fontStyle === 'italic'}
          >
            <ItalicIcon />
          </button>
          <button
            type="button"
            className={textDecoration === 'underline' ? 'is-active' : undefined}
            onClick={() =>
              onChange({ textDecoration: textDecoration === 'underline' ? 'none' : 'underline' })
            }
            title="Subrayado"
            aria-label="Subrayado"
            aria-pressed={textDecoration === 'underline'}
          >
            <UnderlineIcon />
          </button>
          <button
            type="button"
            className={textDecoration === 'line-through' ? 'is-active' : undefined}
            onClick={() =>
              onChange({
                textDecoration: textDecoration === 'line-through' ? 'none' : 'line-through',
              })
            }
            title="Tachado"
            aria-label="Tachado"
            aria-pressed={textDecoration === 'line-through'}
          >
            <StrikethroughIcon />
          </button>
          {onListStyleChange ? (
            <>
              <button
                type="button"
                className={currentList === 'bullet' ? 'is-active' : undefined}
                onClick={() => onListStyleChange(currentList === 'bullet' ? 'none' : 'bullet')}
                title="Viñetas"
                aria-label="Viñetas"
                aria-pressed={currentList === 'bullet'}
              >
                <BulletListIcon />
              </button>
              <button
                type="button"
                className={currentList === 'number' ? 'is-active' : undefined}
                onClick={() => onListStyleChange(currentList === 'number' ? 'none' : 'number')}
                title="Numeración"
                aria-label="Numeración"
                aria-pressed={currentList === 'number'}
              >
                <NumberListIcon />
              </button>
            </>
          ) : null}
        </div>
      </label>
      <label>
        Mayúsculas
        <div className="wysiwyg-align-group" role="group" aria-label="Transformación de texto">
          <button
            type="button"
            className={textTransform === 'uppercase' ? 'is-active' : undefined}
            onClick={() =>
              onChange({ textTransform: textTransform === 'uppercase' ? 'none' : 'uppercase' })
            }
            title="MAYÚSCULAS"
            aria-label="Mayúsculas"
            aria-pressed={textTransform === 'uppercase'}
          >
            <UppercaseIcon />
          </button>
          <button
            type="button"
            className={textTransform === 'lowercase' ? 'is-active' : undefined}
            onClick={() =>
              onChange({ textTransform: textTransform === 'lowercase' ? 'none' : 'lowercase' })
            }
            title="minúsculas"
            aria-label="Minúsculas"
            aria-pressed={textTransform === 'lowercase'}
          >
            <LowercaseIcon />
          </button>
          <button
            type="button"
            className={textTransform === 'capitalize' ? 'is-active' : undefined}
            onClick={() =>
              onChange({ textTransform: textTransform === 'capitalize' ? 'none' : 'capitalize' })
            }
            title="Capitalizar"
            aria-label="Capitalizar"
            aria-pressed={textTransform === 'capitalize'}
          >
            <CapitalizeIcon />
          </button>
        </div>
      </label>
    </>
  );
}

const MOBILE_GOOGLE_FONTS_20 = [
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Playfair Display',
  'Raleway',
  'Oswald',
  'Merriweather',
  'Lora',
  'DM Sans',
  'Anton',
  'Bebas Neue',
  'Caveat',
  'Pacifico',
  'Dancing Script',
  'Great Vibes',
  'Satisfy',
  'Allura',
  'Qwitcher Grypen',
] as const;

export function MobileEditorPage() {
  const { menuId } = useParams<{ menuId: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [assetsError, setAssetsError] = useState('');
  const [title, setTitle] = useState('Carta móvil');
  const [document, setDocument] = useState<MobileMenuDocument>(createDefaultMobileMenuDocument());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [accordionActionError, setAccordionActionError] = useState('');
  const [menuTypoTarget, setMenuTypoTarget] = useState<
    'title' | 'description' | 'price' | 'ingredients'
  >('title');
  const [animationPreview, setAnimationPreview] = useState<{
    componentId: string;
    nonce: number;
  } | null>(null);
  const [livePreviewOpen, setLivePreviewOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [publicSlug, setPublicSlug] = useState<string | null>(null);
  const [imagePickerTarget, setImagePickerTarget] = useState<'image' | 'menuImage' | 'sectionBg' | null>(null);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isPhoneLayout, setIsPhoneLayout] = useState(false);
  const [interactionMode, setInteractionMode] = useState<CanvasInteractionMode>('scroll');
  const [phoneSheet, setPhoneSheet] = useState<'components' | 'props' | 'more' | null>(null);
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [ocrProgress, setOcrProgress] = useState<{
    phase: string;
    percent: number;
    detail?: string;
  } | null>(null);
  const ocrInFlightRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef(document);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  documentRef.current = document;

  useEffect(() => {
    return () => {
      if (persistTimerRef.current != null) clearTimeout(persistTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const apply = () => {
      setIsPhoneLayout(mq.matches);
      if (!mq.matches) setPhoneSheet(null);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!isPhoneLayout || !phoneSheet) return;
    const prev = globalThis.document.body.style.overflow;
    globalThis.document.body.style.overflow = 'hidden';
    return () => {
      globalThis.document.body.style.overflow = prev;
    };
  }, [isPhoneLayout, phoneSheet]);

  useEffect(() => {
    if (!menuId) return;
    let disposed = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { menu } = await getMenu(menuId);
        if (disposed) return;
        setTitle(menu.title || 'Carta móvil');
        setIsPublic(menu.is_public);
        setPublicSlug(menu.public_slug);
        if (menu.editor_kind !== 'mobile') {
          setDocument(createDefaultMobileMenuDocument());
        } else {
          setDocument(normalizeMobileMenuDocument(menu.mobile_document));
        }
      } catch (err) {
        if (!disposed) {
          setError(err instanceof ApiError ? err.message : 'No se pudo cargar la carta móvil.');
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [menuId]);

  const selectedLocation = useMemo(
    () => (selectedId ? findMobileComponentById(document.components, selectedId) : null),
    [document.components, selectedId],
  );
  /** Nodo seleccionado (acordeón, hijo dentro de acordeón, o componente suelto). */
  const selectedNode = selectedLocation?.component ?? null;
  const parentAccordionId = selectedLocation?.parentAccordionId ?? null;
  const parentAccordion = useMemo(() => {
    if (!parentAccordionId) return null;
    const found = findMobileComponentById(document.components, parentAccordionId);
    return found?.component.type === 'accordion' ? found.component : null;
  }, [document.components, parentAccordionId]);
  /**
   * Props de acordeón solo si está seleccionado el contenedor (cabecera),
   * no cuando se edita un hijo del cuerpo.
   */
  const selectedAccordion = selectedNode?.type === 'accordion' ? selectedNode : null;
  /**
   * Objetivo de las props de contenido:
   * - acordeón seleccionado → cabecera (primer hijo)
   * - hijo del cuerpo / componente suelto → él mismo
   */
  const selected = selectedAccordion ? selectedAccordion.children[0] ?? null : selectedNode;
  const propsComponentId = selected?.id ?? null;
  /** Índice del hijo en el cuerpo (para etiqueta); -1 = cabecera o no aplica. */
  const selectedAccordionChildIndex =
    parentAccordion && selectedNode
      ? parentAccordion.children.findIndex((c) => c.id === selectedNode.id)
      : -1;

  const selectedMenuItemFieldTypo = useMemo(() => {
    if (!selected || selected.type !== 'menuItem') return null;
    return {
      ...defaultMenuItemFieldTypography(menuTypoTarget),
      ...selected.menuTypography?.[menuTypoTarget],
    };
  }, [selected, menuTypoTarget]);

  const canCreateAccordion = useMemo(() => {
    if (selectedIds.length < 2) return false;
    return areTopLevelIdsConsecutive(document.components, selectedIds).ok;
  }, [document.components, selectedIds]);
  const selectableSections = useMemo(() => {
    const components = document.components;
    const anchors: Array<{ id: string; index: number; label: string; preview: string }> = [];
    let sectionOrdinal = 0;
    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      if (component.type !== 'section') continue;
      sectionOrdinal += 1;
      const title = component.title.trim() || `Sección ${sectionOrdinal}`;
      let preview = '';
      for (let j = i + 1; j < components.length; j++) {
        const next = components[j];
        if (next.type === 'section') break;
        if (next.type === 'heading' && next.text.trim()) {
          preview = next.text.trim();
          break;
        }
        if (next.type === 'text' && next.text.trim()) {
          preview = next.text.trim();
          break;
        }
        if (next.type === 'menuItem' && next.title.trim()) {
          preview = next.title.trim();
          break;
        }
      }
      if (preview.length > 48) preview = `${preview.slice(0, 45).trimEnd()}…`;
      anchors.push({
        id: component.id,
        index: sectionOrdinal,
        label: title,
        preview,
      });
    }
    return anchors;
  }, [document.components]);

  /** Apply a picked image URL to the correct target field */
  function applyPickedImageUrl(url: string) {
    // Nunca persistir hotlinks de stock (caducan / ToS). Solo URLs propias de R2.
    if (
      !url.includes('/api/assets/file') &&
      /pixabay\.com|pexels\.com|images\.unsplash\.com/i.test(url)
    ) {
      setAssetsError(
        'La imagen de stock no se guardó en tu cuenta. Inténtalo de nuevo o súbela como archivo.',
      );
      return;
    }
    if (imagePickerTarget === 'menuImage') {
      updateSelectedMenuItemImage({ src: url });
    } else if (imagePickerTarget === 'sectionBg') {
      updateSelectedSectionBackground({ src: url });
    } else if (imagePickerTarget === 'image') {
      updateSelectedField('src', url);
    }
  }

  /** Si se sustituye/quita una imagen y ya no se usa en esta carta ni en otras, liberar R2. */
  async function releaseAssetUrlIfUnused(previousUrl: string | undefined | null) {
    if (!previousUrl || !menuId || !previousUrl.includes('/api/assets/file')) return;
    const stillInDoc = JSON.stringify(documentRef.current).includes(previousUrl);
    if (stillInDoc) return;
    try {
      await deleteAsset({ url: previousUrl, exclude_menu_id: menuId });
    } catch {
      /* El GC del guardado en servidor actúa como red de seguridad */
    }
  }

  function openImagePicker(target: 'image' | 'menuImage' | 'sectionBg', mode: 'stock' | 'assets' | 'upload') {
    setImagePickerTarget(target);
    if (mode === 'stock') {
      setStockModalOpen(true);
    } else if (mode === 'assets') {
      setAssetModalOpen(true);
    } else {
      fileInputRef.current?.click();
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    setAssetsError('');
    try {
      const compressed = await compressImage(file, undefined, 'mobile');
      const { asset } = await uploadAsset(compressed);
      applyPickedImageUrl(asset.url);
    } catch (err) {
      setAssetsError(err instanceof ApiError ? err.message : 'Error al subir la imagen');
    } finally {
      setUploading(false);
    }
  }

  async function handleStockSelect(image: StockImage) {
    if (uploading) return;
    setUploading(true);
    setAssetsError('');
    let importedId: string | undefined;
    try {
      // 1) Descargar Pixabay → R2 (URLs de Pixabay caducan / no hotlink)
      let assetUrl: string | undefined;
      try {
        const { asset } = await importStockImage({
          stockImageId: image.id,
          fullUrl: image.fullUrl,
          provider: image.provider,
          fallbackUrls: image.downloadUrls,
        });
        importedId = asset.id;
        assetUrl = asset.url;
      } catch (serverErr) {
        // Fallback: el navegador del usuario a veces sí puede bajar la imagen
        const tryUrls = [
          ...(image.downloadUrls ?? []),
          image.fullUrl,
          image.previewUrl,
        ].filter(Boolean);
        let uploaded: { asset: { id: string; url: string } } | null = null;
        for (const tryUrl of tryUrls) {
          try {
            const res = await fetch(tryUrl, { mode: 'cors', credentials: 'omit' });
            if (!res.ok) continue;
            const blob = await res.blob();
            if (!blob.type.startsWith('image/') || blob.size < 100) continue;
            const file = new File(
              [blob],
              `stock-${image.id}.${blob.type.includes('png') ? 'png' : 'jpg'}`,
              { type: blob.type || 'image/jpeg' },
            );
            const compressed = await compressImage(file, undefined, 'mobile');
            uploaded = await uploadAsset(compressed);
            break;
          } catch {
            /* probar siguiente URL */
          }
        }
        if (!uploaded) {
          throw serverErr instanceof Error
            ? serverErr
            : new Error('No se pudo importar la imagen de stock');
        }
        applyPickedImageUrl(uploaded.asset.url);
        setStockModalOpen(false);
        return;
      }

      // 2) Recomprimir en cliente a perfil móvil (WebP ~1400px) y sustituir en R2
      const remote = await fetch(assetUrl!, { credentials: 'include' });
      if (!remote.ok) {
        applyPickedImageUrl(assetUrl!);
        setStockModalOpen(false);
        return;
      }
      const blob = await remote.blob();
      const input = new File(
        [blob],
        `stock-${image.id}.${blob.type.includes('png') ? 'png' : 'jpg'}`,
        { type: blob.type || 'image/jpeg' },
      );
      const compressed = await compressImage(input, undefined, 'mobile');
      const { asset: optimized } = await uploadAsset(compressed);
      applyPickedImageUrl(optimized.url);
      setStockModalOpen(false);

      if (importedId && importedId !== optimized.id) {
        try {
          await deleteAsset({ id: importedId, force: true });
        } catch {
          // La optimizada ya está en uso; el original huérfano se puede limpiar luego
        }
      }
    } catch (err) {
      setAssetsError(err instanceof ApiError ? err.message : 'Error al importar la imagen de stock');
    } finally {
      setUploading(false);
    }
  }

  async function resolveOcrSourceBlob(source: MobileOcrImportSource): Promise<Blob> {
    if (source.type === 'file') return source.file;
    if (!source.asset.url) {
      throw new Error('El archivo seleccionado no tiene URL válida');
    }
    const response = await fetch(source.asset.url, { credentials: 'include' });
    if (!response.ok) {
      throw new Error('No se pudo cargar la imagen desde tus archivos');
    }
    return response.blob();
  }

  async function handleMobileOcrImport(
    sources: MobileOcrImportSource[],
    options: ImportMenuOptions,
  ) {
    if (ocrInFlightRef.current || sources.length === 0) return;
    ocrInFlightRef.current = true;
    setOcrBusy(true);
    setOcrError('');
    setError('');
    setOcrProgress({ phase: 'prepare', percent: 1, detail: `1 / ${sources.length}` });

    const imported: ReturnType<typeof menuOcrResultToMobileComponents> = [];
    try {
      for (let i = 0; i < sources.length; i++) {
        const source = sources[i];
        const base = Math.round((i / sources.length) * 100);
        const span = Math.max(1, Math.round(100 / sources.length));
        setOcrProgress({
          phase: 'prepare',
          percent: Math.min(99, base + 2),
          detail: `${i + 1} / ${sources.length}`,
        });
        const sourceBlob = await resolveOcrSourceBlob(source);
        const visionInput = await prepareImageForVisionOcr(sourceBlob);
        setOcrProgress({
          phase: 'ocr',
          percent: Math.min(99, base + Math.round(span * 0.15)),
          detail: `${i + 1} / ${sources.length}`,
        });
        const { menu } = await recognizeMenuWithVision(visionInput, {
          provider: options.provider,
          promptExtra: options.promptExtra,
          onProgress: (p) => {
            setOcrProgress({
              phase: 'ocr',
              percent: Math.min(99, base + Math.round(span * (0.15 + (p / 100) * 0.7))),
              detail: `${i + 1} / ${sources.length}`,
            });
          },
        });
        setOcrProgress({
          phase: 'build',
          percent: Math.min(99, base + Math.round(span * 0.92)),
          detail: `${i + 1} / ${sources.length}`,
        });
        imported.push(...menuOcrResultToMobileComponents(menu));
      }

      if (imported.length === 0) {
        throw new Error(
          'No se detectaron platos legibles. Prueba con fotos más nítidas y buen contraste.',
        );
      }

      setOcrProgress({ phase: 'done', percent: 100, detail: `${sources.length} imagen(es)` });
      updateDoc((current) => ({
        ...current,
        components: [...current.components, ...imported],
      }));
      const firstMenuItem = imported.find((c) => c.type === 'menuItem');
      if (firstMenuItem) setSelectedId(firstMenuItem.id);
      setOcrModalOpen(false);
      setOcrError('');
      setPhoneSheet(null);
      const dishCount = countMobileOcrMenuItems(imported);
      if (dishCount === 0) {
        setError(
          'Se importó contenido, pero no se detectaron platos con precio. Revisa las secciones añadidas.',
        );
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo importar la carta';
      setOcrError(message);
      setError(message);
    } finally {
      ocrInFlightRef.current = false;
      setOcrBusy(false);
      setOcrProgress(null);
    }
  }

  useEffect(() => {
    if (!livePreviewOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setLivePreviewOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = globalThis.document.body.style.overflow;
    globalThis.document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      globalThis.document.body.style.overflow = prevOverflow;
    };
  }, [livePreviewOpen]);

  async function persist(nextDoc: MobileMenuDocument, nextTitle = title) {
    if (!menuId) return;
    setSaving(true);
    try {
      let thumbnailUrl: string | null = null;
      try {
        thumbnailUrl = await renderMobileDocumentThumbnail(nextDoc);
      } catch {
        /* El guardado del documento no debe fallar por la miniatura */
      }
      await updateMenu(menuId, {
        title: nextTitle,
        editor_kind: 'mobile',
        mobile_document: nextDoc,
        ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}),
      });
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la carta móvil.');
    } finally {
      setSaving(false);
    }
  }

  function schedulePersist() {
    if (persistTimerRef.current != null) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      void persist(documentRef.current);
    }, 400);
  }

  function updateDoc(
    mutator: (current: MobileMenuDocument) => MobileMenuDocument,
    options?: { debouncePersist?: boolean },
  ) {
    const next = mutator(documentRef.current);
    documentRef.current = next;
    setDocument(next);
    if (options?.debouncePersist) {
      schedulePersist();
      return;
    }
    if (persistTimerRef.current != null) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    void persist(next);
  }

  function handleDropComponent(type: (typeof MOBILE_COMPONENT_LIBRARY)[number]['type']) {
    if (type === 'accordion') return;
    const next = createDefaultMobileComponent(type);
    const insertAfterId = selectedId;
    updateDoc((current) => {
      const list = current.components;
      if (!insertAfterId) {
        return { ...current, components: [...list, next] };
      }
      const index = list.findIndex((c) => c.id === insertAfterId);
      if (index < 0) {
        return { ...current, components: [...list, next] };
      }
      const components = [...list.slice(0, index + 1), next, ...list.slice(index + 1)];
      return { ...current, components };
    });
    setSelectedId(next.id);
    setSelectedIds([next.id]);
    setAccordionActionError('');
  }

  function handleSelectComponent(id: string) {
    setAccordionActionError('');
    if (multiSelectMode) {
      setSelectedIds((prev) => {
        if (prev.includes(id)) {
          const next = prev.filter((x) => x !== id);
          setSelectedId(next[next.length - 1] ?? null);
          return next;
        }
        const next = [...prev, id];
        setSelectedId(id);
        return next;
      });
      return;
    }
    setSelectedId(id);
    setSelectedIds([id]);
  }

  function handleCreateAccordion() {
    const result = createAccordionFromTopLevelIds(documentRef.current.components, selectedIds);
    if ('error' in result) {
      setAccordionActionError(result.error);
      return;
    }
    updateDoc((current) => ({ ...current, components: result.components }));
    setSelectedId(result.accordionId);
    setSelectedIds([result.accordionId]);
    setMultiSelectMode(false);
    setAccordionActionError('');
    if (isPhoneLayout) setPhoneSheet('props');
  }

  function handleUngroupAccordion() {
    if (!selectedId || selectedNode?.type !== 'accordion') return;
    const next = ungroupAccordionById(documentRef.current.components, selectedId);
    if (!next) return;
    const firstChildId = selectedNode.children[0]?.id ?? null;
    updateDoc((current) => ({ ...current, components: next }));
    setSelectedId(firstChildId);
    setSelectedIds(firstChildId ? [firstChildId] : []);
    setAccordionActionError('');
  }

  function togglePhoneSheet(sheet: 'components' | 'props' | 'more') {
    setPhoneSheet((current) => (current === sheet ? null : sheet));
  }

  function handleDeviceChange(nextPresetId: DevicePresetId) {
    const preset = MOBILE_DEVICE_PRESETS.find((p) => p.id === nextPresetId);
    if (!preset) return;
    updateDoc((current) => ({
      ...current,
      viewport: {
        ...current.viewport,
        presetId: preset.id,
        width: preset.width,
        height: preset.height,
      },
    }));
  }

  function handleReorderComponents(orderedIds: string[]) {
    updateDoc((current) => {
      const map = new Map(current.components.map((c) => [c.id, c]));
      const reordered = orderedIds.map((id) => map.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
      if (reordered.length !== current.components.length) return current;
      const same = reordered.every((c, i) => c.id === current.components[i]?.id);
      if (same) return current;
      return { ...current, components: reordered };
    });
  }

  function updateSelectedField(field: string, value: string) {
    if (!propsComponentId) return;
    const previousSrc =
      field === 'src'
        ? (() => {
            const found = findMobileComponentById(documentRef.current.components, propsComponentId);
            const comp = found?.component;
            return comp && 'src' in comp && typeof comp.src === 'string' ? comp.src : undefined;
          })()
        : undefined;
    updateDoc((current) => ({
      ...current,
      components: updateMobileComponentById(current.components, propsComponentId, (component) => {
        if (!(field in component)) return component;
        return { ...component, [field]: value } as typeof component;
      }),
    }));
    if (field === 'src' && previousSrc && previousSrc !== value) {
      void releaseAssetUrlIfUnused(previousSrc);
    }
  }

  function updateSelectedTextListStyle(listStyle: 'none' | 'bullet' | 'number') {
    if (!propsComponentId) return;
    updateDoc((current) => ({
      ...current,
      components: updateMobileComponentById(current.components, propsComponentId, (component) => {
        if (component.type !== 'text') return component;
        return { ...component, listStyle };
      }),
    }));
  }

  function updateSelectedTextIndent(delta: number) {
    if (!propsComponentId) return;
    updateDoc((current) => ({
      ...current,
      components: updateMobileComponentById(current.components, propsComponentId, (component) => {
        if (component.type !== 'text') return component;
        const next = Math.max(0, Math.min(96, (component.indentPx ?? 0) + delta));
        return { ...component, indentPx: next };
      }),
    }));
  }

  function updateSelectedNumberField(field: string, value: number) {
    if (!propsComponentId) return;
    if (!Number.isFinite(value)) return;
    updateDoc((current) => ({
      ...current,
      components: updateMobileComponentById(current.components, propsComponentId, (component) => {
        if (!(field in component)) return component;
        return { ...component, [field]: value } as typeof component;
      }),
    }));
  }

  function updateSelectedAnimation(patch: Partial<MobileAnimationConfig>) {
    if (!selectedId) return;
    updateDoc((current) => ({
      ...current,
      components: updateMobileComponentById(current.components, selectedId, (component) => {
        const base: MobileAnimationConfig = component.animation ?? {
          preset: 'none',
          trigger: 'on_view',
          durationMs: 450,
          delayMs: 0,
          intensity: 1,
        };
        return { ...component, animation: { ...base, ...patch } };
      }),
    }));
    if (patch.trigger !== undefined || patch.preset !== undefined) {
      setAnimationPreview({ componentId: selectedId, nonce: Date.now() });
    }
  }

  function updateSelectedEffect(patch: Partial<MobileEffectConfig>) {
    if (!selectedId) return;
    updateDoc((current) => ({
      ...current,
      components: updateMobileComponentById(current.components, selectedId, (component) => {
        const base: MobileEffectConfig = component.effect ?? {
          type: 'none',
          repeat: 'once',
          trigger: 'on_view',
          durationMs: 600,
          delayMs: 0,
        };
        return { ...component, effect: { ...base, ...patch } };
      }),
    }));
  }

  function previewSelectedAnimation() {
    if (!selectedId) return;
    if ((selectedNode?.animation?.preset ?? 'none') === 'none') return;
    setAnimationPreview({ componentId: selectedId, nonce: Date.now() });
  }

  function updateSelectedAction(patch: Partial<MobileInteractionAction>) {
    if (!propsComponentId) return;
    updateDoc((current) => ({
      ...current,
      components: updateMobileComponentById(current.components, propsComponentId, (component) => {
        if (component.type !== 'button' && component.type !== 'section') return component;
        const base: MobileInteractionAction =
          component.action ??
          (component.type === 'button'
            ? { type: 'url', url: component.href }
            : { type: 'none' });
        const next = { ...base, ...patch };
        if (next.type === 'url' && component.type === 'button') {
          return { ...component, href: next.url ?? component.href, action: next };
        }
        return { ...component, action: next };
      }),
    }));
  }

  function setSelectedActionType(type: MobileInteractionActionType) {
    if (!selected || (selected.type !== 'button' && selected.type !== 'section')) {
      return;
    }
    if (type === 'none') {
      updateSelectedAction({ type, url: undefined, sectionId: undefined, modal: undefined });
      return;
    }
    if (type === 'url') {
      const fallbackUrl = selected.type === 'button' ? selected.href : '';
      updateSelectedAction({ type, url: fallbackUrl, sectionId: undefined, modal: undefined });
      return;
    }
    if (type === 'section') {
      const fallbackSectionId = selectableSections.find((s) => s.id !== selected.id)?.id ?? '';
      updateSelectedAction({ type, sectionId: fallbackSectionId, url: undefined, modal: undefined });
      return;
    }
    updateSelectedAction({
      type: 'modal',
      url: undefined,
      sectionId: undefined,
      modal: {
        title: 'Informacion',
        body: 'Escribe aqui el contenido del modal.',
        closeLabel: 'Cerrar',
      },
    });
  }

  function updateSelectedTypography(
    patch: Partial<MobileTypographyConfig>,
    options?: { debouncePersist?: boolean },
  ) {
    if (!propsComponentId) return;
    updateDoc((current) => ({
      ...current,
      components: updateMobileComponentById(current.components, propsComponentId, (component) => {
        const base: MobileTypographyConfig = component.typography ?? {
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
        };
        const nextTypography = { ...base, ...patch };
        if (nextTypography.fontFamily) ensureEditorFontLoaded(nextTypography.fontFamily);
        return { ...component, typography: nextTypography };
      }),
    }), options);
  }

  function updateSelectedMenuItemTypography(
    target: 'title' | 'description' | 'price' | 'ingredients',
    patch: Partial<MobileTypographyConfig>,
    options?: { debouncePersist?: boolean },
  ) {
    if (!propsComponentId) return;
    updateDoc((current) => ({
      ...current,
      components: updateMobileComponentById(current.components, propsComponentId, (component) => {
        if (component.type !== 'menuItem') return component;
        const base: MobileTypographyConfig = {
          ...defaultMenuItemFieldTypography(target),
          ...component.menuTypography?.[target],
        };
        const nextTypography = { ...base, ...patch };
        if (nextTypography.fontFamily) ensureEditorFontLoaded(nextTypography.fontFamily);
        return {
          ...component,
          menuTypography: {
            ...(component.menuTypography ?? {}),
            [target]: nextTypography,
          },
        };
      }),
    }), options);
  }

  function updateSelectedMenuItemImage(
    patch: Partial<{
      src: string;
      alt: string;
      position: 'left' | 'right';
      width: number;
      radius: number;
    }>,
  ) {
    if (!propsComponentId) return;
    const previousSrc =
      patch.src !== undefined
        ? (() => {
            const found = findMobileComponentById(documentRef.current.components, propsComponentId);
            const comp = found?.component;
            return comp?.type === 'menuItem' ? comp.menuImage?.src : undefined;
          })()
        : undefined;
    updateDoc((current) => ({
      ...current,
      components: updateMobileComponentById(current.components, propsComponentId, (component) => {
        if (component.type !== 'menuItem') return component;
        const base = component.menuImage ?? {
          src: '',
          alt: 'Imagen del plato',
          position: 'left' as const,
          width: 92,
          radius: 10,
        };
        const next = {
          ...base,
          ...patch,
          width: Math.max(56, Math.min(180, Math.round((patch.width ?? base.width) || 92))),
          radius: Math.max(0, Math.min(28, Math.round((patch.radius ?? base.radius) || 10))),
        };
        return { ...component, menuImage: next };
      }),
    }));
    if (patch.src !== undefined && previousSrc && previousSrc !== patch.src) {
      void releaseAssetUrlIfUnused(previousSrc);
    }
  }

  function updateSelectedSectionBackground(
    patch: Partial<{
      src: string;
      align: 'left' | 'center' | 'right';
      stretch: boolean;
    }>,
  ) {
    if (!propsComponentId) return;
    const previousSrc =
      patch.src !== undefined
        ? (() => {
            const found = findMobileComponentById(documentRef.current.components, propsComponentId);
            const comp = found?.component;
            return comp?.type === 'section' ? comp.backgroundImage?.src : undefined;
          })()
        : undefined;
    updateDoc((current) => ({
      ...current,
      components: updateMobileComponentById(current.components, propsComponentId, (component) => {
        if (component.type !== 'section') return component;
        const base = component.backgroundImage ?? {
          src: '',
          align: 'center' as const,
          stretch: true,
        };
        return {
          ...component,
          backgroundImage: {
            ...base,
            ...patch,
          },
        };
      }),
    }));
    if (patch.src !== undefined && previousSrc && previousSrc !== patch.src) {
      void releaseAssetUrlIfUnused(previousSrc);
    }
  }

  function updateSelectedSectionSize(size: MobileSectionSize) {
    if (!propsComponentId) return;
    updateDoc((current) => ({
      ...current,
      components: updateMobileComponentById(current.components, propsComponentId, (component) => {
        if (component.type !== 'section') return component;
        return { ...component, size };
      }),
    }));
  }

  function updateSelectedSectionTextOffset(patch: {
    textOffsetX?: number;
    textOffsetY?: number;
  }) {
    if (!propsComponentId) return;
    updateDoc((current) => ({
      ...current,
      components: updateMobileComponentById(current.components, propsComponentId, (component) => {
        if (component.type !== 'section') return component;
        const next = { ...component };
        if (patch.textOffsetX !== undefined) {
          const value = Math.max(-400, Math.min(400, Math.round(patch.textOffsetX) || 0));
          if (value === 0) delete next.textOffsetX;
          else next.textOffsetX = value;
        }
        if (patch.textOffsetY !== undefined) {
          const value = Math.max(-400, Math.min(400, Math.round(patch.textOffsetY) || 0));
          if (value === 0) delete next.textOffsetY;
          else next.textOffsetY = value;
        }
        return next;
      }),
    }));
  }

  function updateSelectedSectionBorderLine(borderLine: MobileSectionBorderLine) {
    if (!propsComponentId) return;
    updateDoc((current) => ({
      ...current,
      components: updateMobileComponentById(current.components, propsComponentId, (component) => {
        if (component.type !== 'section') return component;
        return { ...component, borderLine };
      }),
    }));
  }

  function updateSelectedSectionBorderRound(borderRound: MobileSectionBorderRound) {
    if (!propsComponentId) return;
    updateDoc((current) => ({
      ...current,
      components: updateMobileComponentById(current.components, propsComponentId, (component) => {
        if (component.type !== 'section') return component;
        return { ...component, borderRound };
      }),
    }));
  }

  function updateSelectedAccordion(patch: {
    defaultOpen?: boolean;
    showChevron?: boolean;
    chevronColor?: string;
    chevronThickness?: number;
  }) {
    if (!selectedId || selectedNode?.type !== 'accordion') return;
    updateDoc((current) => ({
      ...current,
      components: updateMobileComponentById(current.components, selectedId, (component) => {
        if (component.type !== 'accordion') return component;
        const next = { ...component, ...patch };
        if (patch.chevronColor !== undefined) {
          const color = patch.chevronColor.trim();
          if (!color) delete next.chevronColor;
          else next.chevronColor = color.slice(0, 64);
        }
        if (patch.chevronThickness !== undefined) {
          next.chevronThickness = Math.max(1, Math.min(8, Math.round(patch.chevronThickness) || 2));
        }
        return next;
      }),
    }));
  }

  function deleteSelected() {
    if (!selectedId) return;
    void deleteComponent(selectedId);
  }

  async function deleteComponent(id: string) {
    const found = findMobileComponentById(documentRef.current.components, id);
    const component = found?.component;
    const label =
      component && 'title' in component && component.title.trim()
        ? `«${component.title.trim()}»`
        : component && 'text' in component && component.text.trim()
          ? `«${component.text.trim().slice(0, 40)}${component.text.trim().length > 40 ? '…' : ''}»`
          : component && 'label' in component && component.label.trim()
            ? `«${component.label.trim()}»`
            : component?.type === 'accordion'
              ? 'este acordeón'
              : 'este componente';
    const confirmed = await appConfirm(`¿Eliminar ${label}?`, {
      title: 'Eliminar componente',
      variant: 'danger',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;

    updateDoc((current) => ({
      ...current,
      components: removeMobileComponentById(current.components, id),
    }));
    setSelectedIds((prev) => {
      const next = prev.filter((x) => x !== id);
      setSelectedId(next[next.length - 1] ?? null);
      return next;
    });
    if (isPhoneLayout) setPhoneSheet(null);
  }

  function updateSelectedHidden(hidden: boolean) {
    if (!selectedId) return;
    updateDoc((current) => ({
      ...current,
      components: updateMobileComponentById(current.components, selectedId, (component) => {
        if (hidden) return { ...component, hidden: true };
        const { hidden: _removed, ...rest } = component;
        return rest as typeof component;
      }),
    }));
  }

  return (
    <div className={`mobile-editor-page${isPhoneLayout ? ' mobile-editor-page--phone' : ''}`}>
      <AppLayout />
      <main className="mobile-editor-main">
        <header className="mobile-editor-header">
          <h1>Editor móvil</h1>
          <div className="mobile-editor-header-actions">
            <div
              className="mobile-editor-mode-group mobile-editor-desktop-only"
              role="group"
              aria-label="Modo del lienzo"
            >
              <button
                type="button"
                className={interactionMode === 'move' ? 'is-active' : undefined}
                title="Mover y reordenar componentes"
                aria-label="Mover"
                aria-pressed={interactionMode === 'move'}
                onClick={() => setInteractionMode('move')}
              >
                <MoveModeIcon />
              </button>
              <button
                type="button"
                className={interactionMode === 'scroll' ? 'is-active' : undefined}
                title="Desplazar la carta (scroll)"
                aria-label="Scroll"
                aria-pressed={interactionMode === 'scroll'}
                onClick={() => setInteractionMode('scroll')}
              >
                <ScrollModeIcon />
              </button>
            </div>
            <label className="mobile-editor-desktop-only">
              Nombre
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  const nextTitle = e.target.value;
                  setTitle(nextTitle);
                }}
                onBlur={() => void persist(document, title)}
              />
            </label>
            <label className="mobile-editor-desktop-only">
              Dispositivo
              <select
                value={document.viewport.presetId}
                onChange={(e) => handleDeviceChange(e.target.value as DevicePresetId)}
              >
                {MOBILE_DEVICE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn-secondary mobile-editor-desktop-only"
              onClick={() => setOcrModalOpen(true)}
              disabled={loading || ocrBusy}
            >
              Importar con IA
            </button>
            <Link
              to={menuId ? `/editor/${menuId}` : '/dashboard'}
              className="btn-secondary mobile-editor-desktop-only"
            >
              Ir al editor clásico
            </Link>
            <button
              type="button"
              className="btn-primary mobile-editor-desktop-only"
              onClick={() => setLivePreviewOpen(true)}
              disabled={loading}
            >
              Preview
            </button>
            <button
              type="button"
              className="btn-primary mobile-editor-desktop-only"
              onClick={() => setQrOpen(true)}
              disabled={loading || !menuId}
            >
              QR / Publicar
            </button>
            <Link to="/dashboard" className="btn-secondary mobile-editor-desktop-only">
              Volver
            </Link>
            <span className="mobile-editor-phone-status" aria-live="polite">
              {saving ? 'Guardando…' : title}
            </span>
          </div>
        </header>

        {loading && <p>Cargando editor móvil...</p>}
        {error && <div className="error-banner">{error}</div>}

        {!loading && (
          <div className="mobile-editor-layout">
            <aside
              className={`mobile-editor-sidebar${phoneSheet === 'components' ? ' is-phone-sheet-open' : ''}`}
              aria-hidden={isPhoneLayout && phoneSheet !== 'components'}
            >
              <div className="mobile-editor-sheet-grab" aria-hidden="true" />
              <div className="mobile-editor-sheet-header">
                <h3>Componentes</h3>
                {isPhoneLayout && (
                  <button type="button" className="mobile-editor-sheet-close" onClick={() => setPhoneSheet(null)}>
                    ✕
                  </button>
                )}
              </div>
              <p className="panel-hint">
                {isPhoneLayout
                  ? 'Toca un componente para añadirlo a la carta.'
                  : 'Arrastra un componente al teléfono para añadirlo.'}
              </p>
              <ul className="mobile-component-library">
                {MOBILE_COMPONENT_LIBRARY.map((item) => (
                  <li key={item.type}>
                    <button
                      type="button"
                      draggable={!isPhoneLayout}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/mobile-component', item.type);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => handleDropComponent(item.type)}
                    >
                      + {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            <section className="mobile-editor-canvas-wrap">
              <div
                className={`mobile-device-frame is-editor${isPhoneLayout ? ' is-native-phone' : ''}`}
                style={
                  {
                    ['--mobile-viewport-width' as string]: `${document.viewport.width}px`,
                    ['--mobile-viewport-height' as string]: `${document.viewport.height}px`,
                  } as CSSProperties
                }
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const type = e.dataTransfer.getData('text/mobile-component');
                  const lib = MOBILE_COMPONENT_LIBRARY.find((item) => item.type === type);
                  if (!lib) return;
                  handleDropComponent(lib.type);
                }}
              >
                <MobileRuntimeRenderer
                  document={document}
                  editable
                  selectedId={selectedId}
                  selectedIds={selectedIds}
                  onSelect={handleSelectComponent}
                  onReorder={
                    interactionMode === 'move' ? handleReorderComponents : undefined
                  }
                  onDelete={(id) => void deleteComponent(id)}
                  animationPreview={animationPreview}
                />
              </div>
              <p className="panel-hint mobile-editor-desktop-only">
                {saving
                  ? 'Guardando...'
                  : interactionMode === 'scroll'
                    ? 'Modo Scroll: desplaza la carta sin mover componentes · Autoguardado activo'
                    : 'Modo Mover: arrastra componentes para reordenarlos · Autoguardado activo'}
              </p>
            </section>

            <aside
              className={`mobile-editor-properties${phoneSheet === 'props' ? ' is-phone-sheet-open' : ''}`}
              aria-hidden={isPhoneLayout && phoneSheet !== 'props'}
            >
              <div className="mobile-editor-sheet-grab" aria-hidden="true" />
              <div className="mobile-editor-sheet-header">
                <h3>Propiedades</h3>
                {isPhoneLayout && (
                  <button type="button" className="mobile-editor-sheet-close" onClick={() => setPhoneSheet(null)}>
                    ✕
                  </button>
                )}
              </div>
              <div className="mobile-editor-props-pane">
              {!selectedNode && (
                <p className="panel-empty">Selecciona un componente en la carta.</p>
              )}
              {selectedNode && (
                <div className="mobile-props-form">
                  <div className="mobile-selection-tools">
                    <button
                      type="button"
                      className={`btn-secondary${multiSelectMode ? ' is-active' : ''}`}
                      aria-pressed={multiSelectMode}
                      onClick={() => {
                        setMultiSelectMode((v) => !v);
                        setAccordionActionError('');
                      }}
                    >
                      {multiSelectMode ? 'Selección múltiple: ON' : 'Selección múltiple'}
                    </button>
                    {selectedIds.length > 0 && (
                      <small className="panel-hint">
                        {selectedIds.length} seleccionado{selectedIds.length === 1 ? '' : 's'}
                        {multiSelectMode ? ' · toca para añadir o quitar' : ''}
                      </small>
                    )}
                    {selectedIds.length >= 2 && (
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!canCreateAccordion}
                        onClick={handleCreateAccordion}
                      >
                        Crear acordeón
                      </button>
                    )}
                    {accordionActionError && (
                      <small className="panel-hint mobile-accordion-error">{accordionActionError}</small>
                    )}
                  </div>
                  {selectedAccordion && (
                    <>
                      <h4>Acordeón</h4>
                      <small className="panel-hint">
                        Cabecera seleccionada: editas el acordeón y el primer componente. Para
                        editar un plato u otro contenido, abre el acordeón y tócalo.
                      </small>
                      <label>
                        Al cargar
                        <select
                          value={selectedAccordion.defaultOpen === true ? 'open' : 'closed'}
                          onChange={(e) =>
                            updateSelectedAccordion({ defaultOpen: e.target.value === 'open' })
                          }
                        >
                          <option value="closed">Colapsado</option>
                          <option value="open">Abierto</option>
                        </select>
                      </label>
                      <label>
                        Flecha de expansión
                        <select
                          value={selectedAccordion.showChevron === false ? 'hide' : 'show'}
                          onChange={(e) =>
                            updateSelectedAccordion({ showChevron: e.target.value === 'show' })
                          }
                        >
                          <option value="show">Mostrar flecha</option>
                          <option value="hide">Ocultar flecha</option>
                        </select>
                      </label>
                      {selectedAccordion.showChevron !== false && (
                        <>
                          <label>
                            Color de flecha
                            <input
                              type="color"
                              value={selectedAccordion.chevronColor ?? '#64748b'}
                              onChange={(e) =>
                                updateSelectedAccordion({ chevronColor: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            Grosor de flecha
                            <input
                              type="number"
                              min={1}
                              max={8}
                              step={1}
                              value={selectedAccordion.chevronThickness ?? 2}
                              onChange={(e) =>
                                updateSelectedAccordion({
                                  chevronThickness: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                        </>
                      )}
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleUngroupAccordion}
                      >
                        Desagrupar acordeón
                      </button>
                      <h4>Cabecera</h4>
                    </>
                  )}
                  {parentAccordion && selectedAccordionChildIndex > 0 && (
                    <div className="mobile-accordion-child-context">
                      <small className="panel-hint">
                        Contenido del acordeón (ítem {selectedAccordionChildIndex} de{' '}
                        {Math.max(0, parentAccordion.children.length - 1)}).
                      </small>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          if (!parentAccordionId) return;
                          handleSelectComponent(parentAccordionId);
                        }}
                      >
                        Ir a cabecera / opciones del acordeón
                      </button>
                    </div>
                  )}
                  {selected && (
                    <>
                  {'title' in selected && (
                    <label>
                      Título
                      <input
                        type="text"
                        value={selected.title}
                        onChange={(e) => updateSelectedField('title', e.target.value)}
                      />
                    </label>
                  )}
                  {'text' in selected && (
                    <label>
                      Texto
                      <textarea
                        value={selected.text}
                        onChange={(e) => updateSelectedField('text', e.target.value)}
                      />
                    </label>
                  )}
                  {selected.type === 'text' && (
                    <label>
                      Lista y sangría
                      <div className="wysiwyg-align-group" role="group" aria-label="Lista y sangría">
                        <button
                          type="button"
                          className={(selected.listStyle ?? 'none') === 'bullet' ? 'is-active' : undefined}
                          aria-pressed={(selected.listStyle ?? 'none') === 'bullet'}
                          title="Viñetas"
                          aria-label="Viñetas"
                          onClick={() =>
                            updateSelectedTextListStyle(
                              (selected.listStyle ?? 'none') === 'bullet' ? 'none' : 'bullet',
                            )
                          }
                        >
                          <BulletListIcon />
                        </button>
                        <button
                          type="button"
                          className={(selected.listStyle ?? 'none') === 'number' ? 'is-active' : undefined}
                          aria-pressed={(selected.listStyle ?? 'none') === 'number'}
                          title="Numeración"
                          aria-label="Numeración"
                          onClick={() =>
                            updateSelectedTextListStyle(
                              (selected.listStyle ?? 'none') === 'number' ? 'none' : 'number',
                            )
                          }
                        >
                          <NumberListIcon />
                        </button>
                        <button
                          type="button"
                          title="Aumentar sangría"
                          aria-label="Aumentar sangría"
                          onClick={() => updateSelectedTextIndent(16)}
                        >
                          <IndentIcon />
                        </button>
                        <button
                          type="button"
                          title="Reducir sangría"
                          aria-label="Reducir sangría"
                          disabled={(selected.indentPx ?? 0) <= 0}
                          onClick={() => updateSelectedTextIndent(-16)}
                        >
                          <OutdentIcon />
                        </button>
                      </div>
                      <small className="panel-hint">
                        Una línea = un elemento. Sangría actual: {selected.indentPx ?? 0}px.
                      </small>
                    </label>
                  )}
                  {'description' in selected && (
                    <label>
                      Descripción
                      <textarea
                        value={selected.description}
                        onChange={(e) => updateSelectedField('description', e.target.value)}
                      />
                    </label>
                  )}
                  {'price' in selected && (
                    <label>
                      Precio
                      <input
                        type="text"
                        value={selected.price}
                        onChange={(e) => updateSelectedField('price', e.target.value)}
                      />
                    </label>
                  )}
                  {'ingredients' in selected && (
                    <label>
                      Ingredientes
                      <input
                        type="text"
                        value={selected.ingredients}
                        onChange={(e) => updateSelectedField('ingredients', e.target.value)}
                      />
                    </label>
                  )}
                  {selected.type === 'menuItem' && (
                    <div className="allergen-tags-field">
                      <span className="properties-field-label">Alérgenos</span>
                      <div className="allergen-tags" role="group" aria-label="Alérgenos del plato">
                        {COMMON_ALLERGENS.map((allergen) => {
                          const active = isAllergenSelected(selected.allergens, allergen);
                          return (
                            <button
                              key={allergen}
                              type="button"
                              className={active ? 'is-active' : undefined}
                              aria-pressed={active}
                              onClick={() =>
                                updateSelectedField(
                                  'allergens',
                                  toggleAllergenTag(selected.allergens, allergen),
                                )
                              }
                            >
                              {allergen}
                            </button>
                          );
                        })}
                      </div>
                      <small className="panel-hint">
                        Pulsa para activar o desactivar. Sin selección, el plato no muestra alérgenos.
                      </small>
                    </div>
                  )}
                  {selected.type === 'menuItem' && (
                    <>
                      <h4>Imagen del plato</h4>
                      <div className="image-picker-field">
                        {selected.menuImage?.src ? (
                          <div className="image-picker-preview">
                            <img src={selected.menuImage.src} alt={selected.menuImage.alt ?? ''} />
                            <button type="button" className="image-picker-remove" title="Quitar imagen" onClick={() => updateSelectedMenuItemImage({ src: '' })}>✕</button>
                          </div>
                        ) : (
                          <div className="image-picker-empty">Sin imagen</div>
                        )}
                        <div className="image-picker-actions">
                          <button type="button" className="btn-secondary" disabled={uploading} onClick={() => openImagePicker('menuImage', 'assets')}>Mis archivos</button>
                          <button type="button" className="btn-secondary" disabled={uploading} onClick={() => openImagePicker('menuImage', 'stock')}>Stock</button>
                          <button type="button" className="btn-secondary" disabled={uploading} onClick={() => openImagePicker('menuImage', 'upload')}>{uploading && imagePickerTarget === 'menuImage' ? 'Subiendo…' : 'Subir'}</button>
                        </div>
                      </div>
                      <label>
                        Texto alternativo
                        <input
                          type="text"
                          value={selected.menuImage?.alt ?? 'Imagen del plato'}
                          onChange={(e) => updateSelectedMenuItemImage({ alt: e.target.value })}
                        />
                      </label>
                      <label>
                        Posición de imagen
                        <div className="wysiwyg-align-group" role="group" aria-label="Posición de imagen">
                          <button
                            type="button"
                            className={selected.menuImage?.position !== 'right' ? 'is-active' : undefined}
                            onClick={() => updateSelectedMenuItemImage({ position: 'left' })}
                            aria-pressed={selected.menuImage?.position !== 'right'}
                            title="Imagen a la izquierda"
                            aria-label="Imagen a la izquierda"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="2" y="4" width="8" height="8" rx="1" fill="currentColor"/><path fill="currentColor" d="M13 5h9v2h-9zM13 9h7v2h-7zM2 15h20v2H2zM2 19h16v2H2z"/></svg>
                          </button>
                          <button
                            type="button"
                            className={selected.menuImage?.position === 'right' ? 'is-active' : undefined}
                            onClick={() => updateSelectedMenuItemImage({ position: 'right' })}
                            aria-pressed={selected.menuImage?.position === 'right'}
                            title="Imagen a la derecha"
                            aria-label="Imagen a la derecha"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="14" y="4" width="8" height="8" rx="1" fill="currentColor"/><path fill="currentColor" d="M2 5h9v2H2zM4 9h7v2H4zM2 15h20v2H2zM6 19h16v2H6z"/></svg>
                          </button>
                        </div>
                      </label>
                      <label>
                        Ancho imagen (px)
                        <input
                          type="number"
                          min={56}
                          max={180}
                          step={2}
                          value={selected.menuImage?.width ?? 92}
                          onChange={(e) =>
                            updateSelectedMenuItemImage({ width: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label>
                        Radio imagen
                        <input
                          type="number"
                          min={0}
                          max={28}
                          step={1}
                          value={selected.menuImage?.radius ?? 10}
                          onChange={(e) =>
                            updateSelectedMenuItemImage({ radius: Number(e.target.value) })
                          }
                        />
                      </label>
                    </>
                  )}
                  {selected.type === 'section' && (
                    <>
                      <label>
                        Tamaño
                        <select
                          value={selected.size ?? 's'}
                          onChange={(e) =>
                            updateSelectedSectionSize(e.target.value as MobileSectionSize)
                          }
                        >
                          {MOBILE_SECTION_SIZE_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Línea de borde
                        <select
                          value={selected.borderLine ?? 'thin'}
                          onChange={(e) =>
                            updateSelectedSectionBorderLine(
                              e.target.value as MobileSectionBorderLine,
                            )
                          }
                        >
                          {MOBILE_SECTION_BORDER_LINE_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Bordes redondeados
                        <select
                          value={selected.borderRound ?? 'md'}
                          onChange={(e) =>
                            updateSelectedSectionBorderRound(
                              e.target.value as MobileSectionBorderRound,
                            )
                          }
                        >
                          {MOBILE_SECTION_BORDER_ROUND_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <h4>Imagen de fondo</h4>
                      <div className="image-picker-field">
                        {selected.backgroundImage?.src ? (
                          <div className="image-picker-preview">
                            <img src={selected.backgroundImage.src} alt="" />
                            <button
                              type="button"
                              className="image-picker-remove"
                              title="Quitar imagen"
                              onClick={() => updateSelectedSectionBackground({ src: '' })}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="image-picker-empty">Sin imagen</div>
                        )}
                        <div className="image-picker-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={uploading}
                            onClick={() => openImagePicker('sectionBg', 'assets')}
                          >
                            Mis archivos
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={uploading}
                            onClick={() => openImagePicker('sectionBg', 'stock')}
                          >
                            Stock
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={uploading}
                            onClick={() => openImagePicker('sectionBg', 'upload')}
                          >
                            {uploading && imagePickerTarget === 'sectionBg' ? 'Subiendo…' : 'Subir'}
                          </button>
                        </div>
                      </div>
                      {selected.backgroundImage?.src ? (
                        <>
                          <label>
                            Alineación
                            <div className="wysiwyg-align-group" role="group" aria-label="Alineación de imagen de fondo">
                              <button
                                type="button"
                                className={
                                  (selected.backgroundImage.align ?? 'center') === 'left'
                                    ? 'is-active'
                                    : undefined
                                }
                                onClick={() => updateSelectedSectionBackground({ align: 'left' })}
                                aria-pressed={(selected.backgroundImage.align ?? 'center') === 'left'}
                                title="Alinear a la izquierda"
                                aria-label="Alinear a la izquierda"
                              >
                                <AlignLeftIcon />
                              </button>
                              <button
                                type="button"
                                className={
                                  (selected.backgroundImage.align ?? 'center') === 'center'
                                    ? 'is-active'
                                    : undefined
                                }
                                onClick={() => updateSelectedSectionBackground({ align: 'center' })}
                                aria-pressed={(selected.backgroundImage.align ?? 'center') === 'center'}
                                title="Centrar"
                                aria-label="Centrar"
                              >
                                <AlignCenterIcon />
                              </button>
                              <button
                                type="button"
                                className={
                                  (selected.backgroundImage.align ?? 'center') === 'right'
                                    ? 'is-active'
                                    : undefined
                                }
                                onClick={() => updateSelectedSectionBackground({ align: 'right' })}
                                aria-pressed={(selected.backgroundImage.align ?? 'center') === 'right'}
                                title="Alinear a la derecha"
                                aria-label="Alinear a la derecha"
                              >
                                <AlignRightIcon />
                              </button>
                            </div>
                          </label>
                          <label>
                            Ajuste
                            <div className="wysiwyg-align-group" role="group" aria-label="Ajuste de imagen de fondo">
                              <button
                                type="button"
                                className={selected.backgroundImage.stretch !== false ? 'is-active' : undefined}
                                onClick={() =>
                                  updateSelectedSectionBackground({
                                    stretch: selected.backgroundImage?.stretch === false,
                                  })
                                }
                                aria-pressed={selected.backgroundImage.stretch !== false}
                                title="Estirar para ocupar todo el componente"
                                aria-label="Estirar para ocupar todo el componente"
                              >
                                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                                  <path
                                    fill="currentColor"
                                    d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"
                                  />
                                </svg>
                              </button>
                            </div>
                            <small className="panel-hint">
                              Activo: la imagen cubre toda la sección. Desactivado: se adapta sin recortar.
                            </small>
                          </label>
                        </>
                      ) : null}
                      {assetsError && <small className="error-text">{assetsError}</small>}
                    </>
                  )}
                  {selected.type === 'spacer' && (
                    <label>
                      Altura (px)
                      <input
                        type="number"
                        min={4}
                        max={400}
                        step={4}
                        value={selected.height}
                        onChange={(e) => updateSelectedNumberField('height', Number(e.target.value))}
                      />
                    </label>
                  )}
                  {'src' in selected && (
                    <>
                      <label>Imagen</label>
                      <div className="image-picker-field">
                        {selected.src ? (
                          <div className="image-picker-preview">
                            <img src={selected.src as string} alt="" />
                            <button type="button" className="image-picker-remove" title="Quitar imagen" onClick={() => updateSelectedField('src', '')}>✕</button>
                          </div>
                        ) : (
                          <div className="image-picker-empty">Sin imagen</div>
                        )}
                        <div className="image-picker-actions">
                          <button type="button" className="btn-secondary" disabled={uploading} onClick={() => openImagePicker('image', 'assets')}>Mis archivos</button>
                          <button type="button" className="btn-secondary" disabled={uploading} onClick={() => openImagePicker('image', 'stock')}>Stock</button>
                          <button type="button" className="btn-secondary" disabled={uploading} onClick={() => openImagePicker('image', 'upload')}>{uploading && imagePickerTarget === 'image' ? 'Subiendo…' : 'Subir'}</button>
                        </div>
                      </div>
                      {assetsError && <small className="error-text">{assetsError}</small>}
                    </>
                  )}
                  {(selected.type === 'button' || selected.type === 'section') && (
                    <>
                      <label>
                        Acción al tocar
                        <select
                          value={selected.action?.type ?? (selected.type === 'button' ? 'url' : 'none')}
                          onChange={(e) => setSelectedActionType(e.target.value as MobileInteractionActionType)}
                        >
                          <option value="none">Sin acción</option>
                          <option value="url">Abrir URL</option>
                          <option value="section">Ir a sección</option>
                          <option value="modal">Abrir modal</option>
                        </select>
                      </label>
                      {(selected.action?.type ?? (selected.type === 'button' ? 'url' : 'none')) === 'url' && (
                        <label>
                          URL destino
                          <input
                            type="text"
                            value={selected.action?.url ?? (selected.type === 'button' ? selected.href : '')}
                            onChange={(e) => updateSelectedAction({ type: 'url', url: e.target.value })}
                          />
                        </label>
                      )}
                      {(selected.action?.type ?? (selected.type === 'button' ? 'url' : 'none')) === 'section' && (
                        <div className="mobile-section-anchor-field">
                          <span className="mobile-section-anchor-label">Sección destino</span>
                          {selectableSections.filter((section) => section.id !== selected.id).length === 0 ? (
                            <p className="panel-empty">No hay otras secciones para enlazar. Añade una sección primero.</p>
                          ) : (
                            <ul className="mobile-section-anchor-list" role="listbox" aria-label="Secciones destino">
                              {selectableSections
                                .filter((section) => section.id !== selected.id)
                                .map((section) => {
                                  const isActive = (selected.action?.sectionId ?? '') === section.id;
                                  return (
                                    <li key={section.id}>
                                      <button
                                        type="button"
                                        role="option"
                                        aria-selected={isActive}
                                        className={`mobile-section-anchor-item${isActive ? ' is-active' : ''}`}
                                        onClick={() =>
                                          updateSelectedAction({ type: 'section', sectionId: section.id })
                                        }
                                      >
                                        <span className="mobile-section-anchor-index">{section.index}</span>
                                        <span className="mobile-section-anchor-copy">
                                          <strong>{section.label}</strong>
                                          {section.preview ? (
                                            <small>{section.preview}</small>
                                          ) : (
                                            <small>Sin contenido siguiente</small>
                                          )}
                                        </span>
                                      </button>
                                    </li>
                                  );
                                })}
                            </ul>
                          )}
                        </div>
                      )}
                      {(selected.action?.type ?? (selected.type === 'button' ? 'url' : 'none')) === 'modal' && (
                        <>
                          <label>
                            Título modal
                            <input
                              type="text"
                              value={selected.action?.modal?.title ?? ''}
                              onChange={(e) =>
                                updateSelectedAction({
                                  type: 'modal',
                                  modal: {
                                    title: e.target.value,
                                    body: selected.action?.modal?.body ?? '',
                                    closeLabel: selected.action?.modal?.closeLabel ?? 'Cerrar',
                                  },
                                })
                              }
                            />
                          </label>
                          <label>
                            Contenido modal
                            <textarea
                              value={selected.action?.modal?.body ?? ''}
                              onChange={(e) =>
                                updateSelectedAction({
                                  type: 'modal',
                                  modal: {
                                    title: selected.action?.modal?.title ?? 'Informacion',
                                    body: e.target.value,
                                    closeLabel: selected.action?.modal?.closeLabel ?? 'Cerrar',
                                  },
                                })
                              }
                            />
                          </label>
                          <label>
                            Texto botón cierre
                            <input
                              type="text"
                              value={selected.action?.modal?.closeLabel ?? 'Cerrar'}
                              onChange={(e) =>
                                updateSelectedAction({
                                  type: 'modal',
                                  modal: {
                                    title: selected.action?.modal?.title ?? 'Informacion',
                                    body: selected.action?.modal?.body ?? '',
                                    closeLabel: e.target.value,
                                  },
                                })
                              }
                            />
                          </label>
                        </>
                      )}
                    </>
                  )}
                  <label>
                    Animación
                    <select
                      value={selectedNode.animation?.preset ?? 'none'}
                      onChange={(e) =>
                        updateSelectedAnimation({ preset: e.target.value as MobileAnimationPreset })
                      }
                    >
                      <option value="none">Sin animación</option>
                      <option value="reveal">Reveal</option>
                      <option value="tap">Tap</option>
                      <option value="parallax">Parallax</option>
                      <option value="lottie">Lottie (placeholder visual)</option>
                    </select>
                  </label>
                  <label>
                    Trigger
                    <select
                      value={selectedNode.animation?.trigger ?? 'on_view'}
                      onChange={(e) =>
                        updateSelectedAnimation({ trigger: e.target.value as MobileAnimationTrigger })
                      }
                    >
                      <option value="on_view">Al entrar en viewport</option>
                      <option value="on_load">Al cargar</option>
                      <option value="on_tap">Al tocar</option>
                    </select>
                    <small className="panel-hint">
                      Al cambiar Trigger o Animación se reproduce un preview en el móvil.
                    </small>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={previewSelectedAnimation}
                      disabled={(selectedNode.animation?.preset ?? 'none') === 'none'}
                    >
                      Ver preview
                    </button>
                  </label>
                  {selected && selected.type !== 'menuItem' && (
                    <>
                  <h4>Tipografía</h4>
                  <label>
                    Fuente
                    <select
                      value={selected.typography?.fontFamily ?? 'Roboto'}
                      onChange={(e) => updateSelectedTypography({ fontFamily: e.target.value })}
                    >
                      {MOBILE_GOOGLE_FONTS_20.map((font) => (
                        <option key={font} value={font} style={{ fontFamily: font }}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Alineación
                    <div className="wysiwyg-align-group" role="group" aria-label="Alineación de texto">
                      <button
                        type="button"
                        className={selected.typography?.textAlign === 'left' ? 'is-active' : undefined}
                        onClick={() => updateSelectedTypography({ textAlign: 'left' })}
                        title="Alinear a la izquierda"
                        aria-label="Alinear a la izquierda"
                      >
                        <AlignLeftIcon />
                      </button>
                      <button
                        type="button"
                        className={selected.typography?.textAlign === 'center' ? 'is-active' : undefined}
                        onClick={() => updateSelectedTypography({ textAlign: 'center' })}
                        title="Centrar"
                        aria-label="Centrar"
                      >
                        <AlignCenterIcon />
                      </button>
                      <button
                        type="button"
                        className={selected.typography?.textAlign === 'right' ? 'is-active' : undefined}
                        onClick={() => updateSelectedTypography({ textAlign: 'right' })}
                        title="Alinear a la derecha"
                        aria-label="Alinear a la derecha"
                      >
                        <AlignRightIcon />
                      </button>
                    </div>
                  </label>
                  <label>
                    Tamaño (px)
                    <input
                      type="number"
                      min={8}
                      max={96}
                      step={1}
                      value={selected.typography?.fontSize ?? 16}
                      onChange={(e) => updateSelectedTypography({ fontSize: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Peso
                    <input
                      type="number"
                      min={100}
                      max={900}
                      step={100}
                      value={selected.typography?.fontWeight ?? 400}
                      onChange={(e) => updateSelectedTypography({ fontWeight: Number(e.target.value) })}
                    />
                  </label>
                  <TypographyStyleToolbar
                    fontStyle={selected.typography?.fontStyle ?? 'normal'}
                    textDecoration={selected.typography?.textDecoration ?? 'none'}
                    textTransform={selected.typography?.textTransform ?? 'none'}
                    onChange={updateSelectedTypography}
                    listStyle={selected.type === 'text' ? (selected.listStyle ?? 'none') : undefined}
                    onListStyleChange={
                      selected.type === 'text' ? updateSelectedTextListStyle : undefined
                    }
                  />
                  <label>
                    Interlineado
                    <input
                      type="number"
                      min={1}
                      max={3}
                      step={0.05}
                      value={selected.typography?.lineHeight ?? 1.45}
                      onChange={(e) => updateSelectedTypography({ lineHeight: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Espaciado de letras (px)
                    <input
                      type="number"
                      min={-2}
                      max={12}
                      step={0.1}
                      value={selected.typography?.letterSpacing ?? 0}
                      onChange={(e) => updateSelectedTypography({ letterSpacing: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Color de texto
                    <input
                      type="color"
                      value={selected.typography?.color ?? '#111827'}
                      onChange={(e) =>
                        updateSelectedTypography({ color: e.target.value }, { debouncePersist: true })
                      }
                    />
                  </label>
                  {selected.type === 'section' && (
                    <>
                      <label>
                        Margen izquierdo (px)
                        <input
                          type="number"
                          min={-400}
                          max={400}
                          step={1}
                          value={selected.textOffsetX ?? 0}
                          onChange={(e) =>
                            updateSelectedSectionTextOffset({
                              textOffsetX: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label>
                        Desplazamiento vertical (px)
                        <input
                          type="number"
                          min={-400}
                          max={400}
                          step={1}
                          value={selected.textOffsetY ?? 0}
                          onChange={(e) =>
                            updateSelectedSectionTextOffset({
                              textOffsetY: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <small className="panel-hint">
                        Negativo mueve el texto a la izquierda / arriba. Positivo a la derecha / abajo.
                      </small>
                    </>
                  )}
                    </>
                  )}
                  {selected.type === 'menuItem' && selectedMenuItemFieldTypo && (
                    <>
                      <h4>Tipografía</h4>
                      <label>
                        Campo
                        <select
                          value={menuTypoTarget}
                          onChange={(e) =>
                            setMenuTypoTarget(
                              e.target.value as 'title' | 'description' | 'price' | 'ingredients',
                            )
                          }
                        >
                          <option value="title">Nombre del plato</option>
                          <option value="description">Descripción</option>
                          <option value="price">Precio</option>
                          <option value="ingredients">Ingredientes</option>
                        </select>
                      </label>
                      <label>
                        Fuente
                        <select
                          value={selectedMenuItemFieldTypo.fontFamily}
                          onChange={(e) =>
                            updateSelectedMenuItemTypography(menuTypoTarget, {
                              fontFamily: e.target.value,
                            })
                          }
                        >
                          {MOBILE_GOOGLE_FONTS_20.map((font) => (
                            <option key={font} value={font} style={{ fontFamily: font }}>
                              {font}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Alineación
                        <div className="wysiwyg-align-group" role="group" aria-label="Alineación de texto">
                          <button
                            type="button"
                            className={selectedMenuItemFieldTypo.textAlign === 'left' ? 'is-active' : undefined}
                            onClick={() =>
                              updateSelectedMenuItemTypography(menuTypoTarget, { textAlign: 'left' })
                            }
                            title="Alinear a la izquierda"
                            aria-label="Alinear a la izquierda"
                          >
                            <AlignLeftIcon />
                          </button>
                          <button
                            type="button"
                            className={
                              selectedMenuItemFieldTypo.textAlign === 'center' ? 'is-active' : undefined
                            }
                            onClick={() =>
                              updateSelectedMenuItemTypography(menuTypoTarget, { textAlign: 'center' })
                            }
                            title="Centrar"
                            aria-label="Centrar"
                          >
                            <AlignCenterIcon />
                          </button>
                          <button
                            type="button"
                            className={selectedMenuItemFieldTypo.textAlign === 'right' ? 'is-active' : undefined}
                            onClick={() =>
                              updateSelectedMenuItemTypography(menuTypoTarget, { textAlign: 'right' })
                            }
                            title="Alinear a la derecha"
                            aria-label="Alinear a la derecha"
                          >
                            <AlignRightIcon />
                          </button>
                        </div>
                      </label>
                      <label>
                        Tamaño (px)
                        <input
                          type="number"
                          min={8}
                          max={96}
                          step={1}
                          value={selectedMenuItemFieldTypo.fontSize}
                          onChange={(e) =>
                            updateSelectedMenuItemTypography(menuTypoTarget, {
                              fontSize: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label>
                        Peso
                        <input
                          type="number"
                          min={100}
                          max={900}
                          step={100}
                          value={selectedMenuItemFieldTypo.fontWeight}
                          onChange={(e) =>
                            updateSelectedMenuItemTypography(menuTypoTarget, {
                              fontWeight: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <TypographyStyleToolbar
                        fontStyle={selectedMenuItemFieldTypo.fontStyle}
                        textDecoration={selectedMenuItemFieldTypo.textDecoration}
                        textTransform={selectedMenuItemFieldTypo.textTransform}
                        onChange={(patch) => updateSelectedMenuItemTypography(menuTypoTarget, patch)}
                      />
                      <label>
                        Interlineado
                        <input
                          type="number"
                          min={1}
                          max={3}
                          step={0.05}
                          value={selectedMenuItemFieldTypo.lineHeight}
                          onChange={(e) =>
                            updateSelectedMenuItemTypography(menuTypoTarget, {
                              lineHeight: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label>
                        Espaciado de letras (px)
                        <input
                          type="number"
                          min={-2}
                          max={12}
                          step={0.1}
                          value={selectedMenuItemFieldTypo.letterSpacing}
                          onChange={(e) =>
                            updateSelectedMenuItemTypography(menuTypoTarget, {
                              letterSpacing: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label>
                        Color de texto
                        <input
                          type="color"
                          value={selectedMenuItemFieldTypo.color}
                          onChange={(e) =>
                            updateSelectedMenuItemTypography(
                              menuTypoTarget,
                              { color: e.target.value },
                              { debouncePersist: true },
                            )
                          }
                        />
                      </label>
                    </>
                  )}
                  <label>
                    Duración (ms)
                    <input
                      type="number"
                      min={0}
                      max={5000}
                      step={50}
                      value={selectedNode.animation?.durationMs ?? 450}
                      onChange={(e) => updateSelectedAnimation({ durationMs: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Delay (ms)
                    <input
                      type="number"
                      min={0}
                      max={5000}
                      step={50}
                      value={selectedNode.animation?.delayMs ?? 0}
                      onChange={(e) => updateSelectedAnimation({ delayMs: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Intensidad
                    <input
                      type="range"
                      min={0.1}
                      max={3}
                      step={0.1}
                      value={selectedNode.animation?.intensity ?? 1}
                      onChange={(e) => updateSelectedAnimation({ intensity: Number(e.target.value) })}
                    />
                  </label>
                  <h4>Efecto visual</h4>
                  <label>
                    Efecto
                    <select
                      value={selectedNode.effect?.type ?? 'none'}
                      onChange={(e) => updateSelectedEffect({ type: e.target.value as MobileEffectType })}
                    >
                      <option value="none">Sin efecto</option>
                      <option value="pulse">Pulsar</option>
                      <option value="shake">Vibrar</option>
                      <option value="bounce">Rebotar</option>
                      <option value="glow">Destello</option>
                      <option value="shimmer">Brillo deslizante</option>
                      <option value="heartbeat">Latido</option>
                      <option value="swing">Balanceo</option>
                      <option value="rubberBand">Elástico</option>
                      <option value="flash">Parpadeo</option>
                    </select>
                  </label>
                  {(selectedNode.effect?.type ?? 'none') !== 'none' && (
                    <>
                      <label>
                        Repetición
                        <select
                          value={selectedNode.effect?.repeat ?? 'once'}
                          onChange={(e) => updateSelectedEffect({ repeat: e.target.value as MobileEffectRepeat })}
                        >
                          <option value="once">Una vez</option>
                          <option value="loop">En bucle</option>
                        </select>
                      </label>
                      <label>
                        Activación
                        <select
                          value={selectedNode.effect?.trigger ?? 'on_view'}
                          onChange={(e) => updateSelectedEffect({ trigger: e.target.value as MobileEffectTrigger })}
                        >
                          <option value="on_view">Al ser visible</option>
                          <option value="on_load">Al cargar</option>
                          <option value="always">Siempre</option>
                        </select>
                      </label>
                      <label>
                        Duración (ms): {selectedNode.effect?.durationMs ?? 600}
                        <input
                          type="range"
                          min={100}
                          max={3000}
                          step={50}
                          value={selectedNode.effect?.durationMs ?? 600}
                          onChange={(e) => updateSelectedEffect({ durationMs: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        Retardo (ms): {selectedNode.effect?.delayMs ?? 0}
                        <input
                          type="range"
                          min={0}
                          max={3000}
                          step={50}
                          value={selectedNode.effect?.delayMs ?? 0}
                          onChange={(e) => updateSelectedEffect({ delayMs: Number(e.target.value) })}
                        />
                      </label>
                    </>
                  )}
                  <label>
                    Visibilidad pública
                    <select
                      value={selectedNode.hidden === true ? 'hidden' : 'visible'}
                      onChange={(e) => updateSelectedHidden(e.target.value === 'hidden')}
                    >
                      <option value="visible">Mostrar</option>
                      <option value="hidden">Ocultar</option>
                    </select>
                  </label>
                  <button type="button" className="danger" onClick={deleteSelected}>
                    Eliminar componente
                  </button>
                    </>
                  )}
                </div>
              )}
              </div>
            </aside>
          </div>
        )}

        {isPhoneLayout && phoneSheet && (
          <button
            type="button"
            className="mobile-editor-phone-backdrop"
            aria-label="Cerrar panel"
            onClick={() => setPhoneSheet(null)}
          />
        )}

        {isPhoneLayout && (
          <aside
            className={`mobile-editor-more-sheet${phoneSheet === 'more' ? ' is-phone-sheet-open' : ''}`}
            aria-hidden={phoneSheet !== 'more'}
          >
            <div className="mobile-editor-sheet-grab" aria-hidden="true" />
            <div className="mobile-editor-sheet-header">
              <h3>Opciones</h3>
              <button type="button" className="mobile-editor-sheet-close" onClick={() => setPhoneSheet(null)}>
                ✕
              </button>
            </div>
            <div className="mobile-editor-more-body">
              <div className="mobile-editor-more-mode">
                <span className="mobile-editor-more-mode-label">Modo del lienzo</span>
                <div className="mobile-editor-mode-group" role="group" aria-label="Modo del lienzo">
                  <button
                    type="button"
                    className={interactionMode === 'move' ? 'is-active' : undefined}
                    title="Mover: mantén pulsado un componente para reordenarlo"
                    aria-label="Mover"
                    aria-pressed={interactionMode === 'move'}
                    onClick={() => setInteractionMode('move')}
                  >
                    <MoveModeIcon />
                    <span className="mobile-editor-mode-text">Mover</span>
                  </button>
                  <button
                    type="button"
                    className={interactionMode === 'scroll' ? 'is-active' : undefined}
                    title="Scroll: desplaza la carta sin mover componentes"
                    aria-label="Scroll"
                    aria-pressed={interactionMode === 'scroll'}
                    onClick={() => setInteractionMode('scroll')}
                  >
                    <ScrollModeIcon />
                    <span className="mobile-editor-mode-text">Scroll</span>
                  </button>
                </div>
                <small className="panel-hint">
                  {interactionMode === 'move'
                    ? 'Mantén pulsado un componente y arrástralo para reordenarlo. Las propiedades se abren con Editar.'
                    : 'Desplaza la carta con el dedo. Toca un componente para seleccionarlo y pulsa Editar para sus propiedades.'}
                </small>
              </div>
              <button
                type="button"
                className={`btn-secondary${multiSelectMode ? ' is-active' : ''}`}
                aria-pressed={multiSelectMode}
                onClick={() => {
                  setMultiSelectMode((v) => !v);
                  setAccordionActionError('');
                }}
              >
                {multiSelectMode ? 'Selección múltiple: ON' : 'Selección múltiple'}
              </button>
              {selectedIds.length >= 2 && (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!canCreateAccordion}
                  onClick={() => {
                    handleCreateAccordion();
                    setPhoneSheet(null);
                  }}
                >
                  Crear acordeón ({selectedIds.length})
                </button>
              )}
              {accordionActionError && (
                <small className="panel-hint mobile-accordion-error">{accordionActionError}</small>
              )}
              <label>
                Nombre
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => void persist(document, title)}
                />
              </label>
              <label>
                Dispositivo
                <select
                  value={document.viewport.presetId}
                  onChange={(e) => handleDeviceChange(e.target.value as DevicePresetId)}
                >
                  {MOBILE_DEVICE_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn-primary"
                disabled={ocrBusy}
                onClick={() => {
                  setPhoneSheet(null);
                  setOcrModalOpen(true);
                }}
              >
                Importar con IA
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!menuId}
                onClick={() => {
                  setPhoneSheet(null);
                  setQrOpen(true);
                }}
              >
                QR / Publicar
              </button>
              <Link
                to={menuId ? `/editor/${menuId}` : '/dashboard'}
                className="btn-secondary"
                onClick={() => setPhoneSheet(null)}
              >
                Ir al editor clásico
              </Link>
              <Link to="/dashboard" className="btn-secondary" onClick={() => setPhoneSheet(null)}>
                Mis menús
              </Link>
            </div>
          </aside>
        )}

        {isPhoneLayout && (
          <nav className="mobile-editor-phone-dock" aria-label="Herramientas del editor">
            <button
              type="button"
              className={phoneSheet === 'components' ? 'is-active' : undefined}
              aria-pressed={phoneSheet === 'components'}
              onClick={() => togglePhoneSheet('components')}
            >
              <span aria-hidden="true">＋</span>
              Añadir
            </button>
            <button
              type="button"
              className={phoneSheet === 'props' ? 'is-active' : undefined}
              aria-pressed={phoneSheet === 'props'}
              onClick={() => togglePhoneSheet('props')}
            >
              <span aria-hidden="true">✎</span>
              Editar
            </button>
            <button type="button" onClick={() => setLivePreviewOpen(true)}>
              <span aria-hidden="true">▷</span>
              Preview
            </button>
            <button
              type="button"
              className={phoneSheet === 'more' ? 'is-active' : undefined}
              aria-pressed={phoneSheet === 'more'}
              onClick={() => togglePhoneSheet('more')}
            >
              <span aria-hidden="true">⋯</span>
              Más
            </button>
          </nav>
        )}
      </main>

      {livePreviewOpen && (
        <div
          className="mobile-live-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Preview de la carta móvil"
        >
          <div className="mobile-live-preview-toolbar">
            <div className="mobile-live-preview-toolbar-copy">
              <strong>Preview</strong>
              <span>Como en la URL pública. Prueba botones, modales y saltos entre secciones.</span>
            </div>
            <button type="button" className="btn-secondary" onClick={() => setLivePreviewOpen(false)}>
              Cerrar preview
            </button>
          </div>
          <div className="mobile-live-preview-stage">
            <div
              className="mobile-device-frame is-live-preview"
              style={
                {
                  ['--mobile-viewport-width' as string]: `${document.viewport.width}px`,
                  ['--mobile-viewport-height' as string]: `${document.viewport.height}px`,
                } as CSSProperties
              }
            >
              <MobileRuntimeRenderer document={document} openLinksInNewTab />
            </div>
          </div>
        </div>
      )}

      <MobileImportOcrModal
        open={ocrModalOpen}
        onClose={() => {
          if (ocrBusy) return;
          setOcrModalOpen(false);
          setOcrError('');
        }}
        onImport={(sources, options) => void handleMobileOcrImport(sources, options)}
        busy={ocrBusy}
        progress={ocrProgress}
        error={ocrError}
      />

      {/* QR / Publish modal */}
      {menuId && (
        <PublishQrModal
          open={qrOpen}
          menuId={menuId}
          menuTitle={title}
          initialSlug={publicSlug}
          initialPublic={isPublic}
          onClose={() => setQrOpen(false)}
          onStatusChange={(pub, slug) => {
            setIsPublic(pub);
            setPublicSlug(slug);
          }}
        />
      )}

      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => void handleFileUpload(e)}
      />

      {/* Stock image search modal */}
      <StockImageSearch
        open={stockModalOpen}
        onClose={() => !uploading && setStockModalOpen(false)}
        onSelect={(img) => {
          void handleStockSelect(img);
        }}
        busy={uploading}
      />

      {/* Asset manager modal */}
      <AssetManagerModal
        open={assetModalOpen}
        onClose={() => setAssetModalOpen(false)}
        menuId={menuId}
        onUseOnPage={(asset) => {
          if (asset.url) {
            applyPickedImageUrl(asset.url);
          }
          setAssetModalOpen(false);
        }}
        onAssetDeleted={() => undefined}
      />
    </div>
  );
}
