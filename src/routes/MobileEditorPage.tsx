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
import { ApiError, getMenu, listAssets, updateMenu, uploadAsset, type AssetSummary } from '@/lib/api';
import { renderMobileDocumentThumbnail } from '@/lib/menu-thumbnail';
import { StockImageSearch } from '@/components/editor/StockImageSearch';
import { AssetManagerModal } from '@/components/editor/AssetManagerModal';
import { PublishQrModal } from '@/components/editor/PublishQrModal';
import { ensureEditorFontLoaded } from '@/lib/google-fonts';
import {
  MOBILE_COMPONENT_LIBRARY,
  MOBILE_DEVICE_PRESETS,
  COMMON_ALLERGENS,
  createDefaultMobileComponent,
  createDefaultMobileMenuDocument,
  defaultMenuItemFieldTypography,
  isAllergenSelected,
  normalizeMobileMenuDocument,
  toggleAllergenTag,
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

function TypographyStyleToolbar({
  fontStyle,
  textDecoration,
  textTransform,
  onChange,
}: {
  fontStyle: MobileTypographyConfig['fontStyle'];
  textDecoration: MobileTypographyConfig['textDecoration'];
  textTransform: MobileTypographyConfig['textTransform'];
  onChange: (patch: Partial<MobileTypographyConfig>) => void;
}) {
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
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
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
  const [imagePickerTarget, setImagePickerTarget] = useState<'image' | 'menuImage' | null>(null);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isPhoneLayout, setIsPhoneLayout] = useState(false);
  const [phoneSheet, setPhoneSheet] = useState<'components' | 'props' | 'more' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const selected = useMemo(
    () => document.components.find((component) => component.id === selectedId) ?? null,
    [document.components, selectedId],
  );
  const selectedMenuItemFieldTypo = useMemo(() => {
    if (!selected || selected.type !== 'menuItem') return null;
    return {
      ...defaultMenuItemFieldTypography(menuTypoTarget),
      ...selected.menuTypography?.[menuTypoTarget],
    };
  }, [selected, menuTypoTarget]);
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

  async function loadAssetsForUser() {
    setLoadingAssets(true);
    setAssetsError('');
    try {
      const { assets: data } = await listAssets();
      setAssets(data.filter((a) => !!a.url));
    } catch (err) {
      setAssetsError(err instanceof ApiError ? err.message : 'No se pudieron cargar los assets.');
    } finally {
      setLoadingAssets(false);
    }
  }

  useEffect(() => {
    if (!loading) {
      void loadAssetsForUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  /** Apply a picked image URL to the correct target field */
  function applyPickedImageUrl(url: string) {
    if (imagePickerTarget === 'menuImage') {
      updateSelectedMenuItemImage({ src: url });
    } else if (imagePickerTarget === 'image') {
      updateSelectedField('src', url);
    }
  }

  function openImagePicker(target: 'image' | 'menuImage', mode: 'stock' | 'assets' | 'upload') {
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
    try {
      const { asset } = await uploadAsset(file);
      applyPickedImageUrl(asset.url);
      setAssets((prev) => [{ id: asset.id, url: asset.url, r2_key: null, source: 'upload', created_at: new Date().toISOString() } as AssetSummary, ...prev]);
    } catch (err) {
      setAssetsError(err instanceof ApiError ? err.message : 'Error al subir la imagen');
    } finally {
      setUploading(false);
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

  function updateDoc(mutator: (current: MobileMenuDocument) => MobileMenuDocument) {
    const next = mutator(document);
    setDocument(next);
    void persist(next);
  }

  function handleDropComponent(type: (typeof MOBILE_COMPONENT_LIBRARY)[number]['type']) {
    const next = createDefaultMobileComponent(type);
    updateDoc((current) => ({
      ...current,
      components: [...current.components, next],
    }));
    setSelectedId(next.id);
    if (isPhoneLayout) setPhoneSheet('props');
  }

  function handleSelectComponent(id: string) {
    setSelectedId(id);
    if (isPhoneLayout) setPhoneSheet('props');
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
    if (!selectedId) return;
    updateDoc((current) => ({
      ...current,
      components: current.components.map((component) => {
        if (component.id !== selectedId) return component;
        if (!(field in component)) return component;
        return { ...component, [field]: value } as typeof component;
      }),
    }));
  }

  function updateSelectedNumberField(field: string, value: number) {
    if (!selectedId) return;
    if (!Number.isFinite(value)) return;
    updateDoc((current) => ({
      ...current,
      components: current.components.map((component) => {
        if (component.id !== selectedId) return component;
        if (!(field in component)) return component;
        return { ...component, [field]: value } as typeof component;
      }),
    }));
  }

  function updateSelectedAnimation(patch: Partial<MobileAnimationConfig>) {
    if (!selectedId) return;
    updateDoc((current) => ({
      ...current,
      components: current.components.map((component) => {
        if (component.id !== selectedId) return component;
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
      components: current.components.map((component) => {
        if (component.id !== selectedId) return component;
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
    if ((selected?.animation?.preset ?? 'none') === 'none') return;
    setAnimationPreview({ componentId: selectedId, nonce: Date.now() });
  }

  function updateSelectedAction(patch: Partial<MobileInteractionAction>) {
    if (!selectedId) return;
    updateDoc((current) => ({
      ...current,
      components: current.components.map((component) => {
        if (component.id !== selectedId) return component;
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
    if (!selected || (selected.type !== 'button' && selected.type !== 'section')) return;
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

  function updateSelectedTypography(patch: Partial<MobileTypographyConfig>) {
    if (!selectedId) return;
    updateDoc((current) => ({
      ...current,
      components: current.components.map((component) => {
        if (component.id !== selectedId) return component;
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
    }));
  }

  function updateSelectedMenuItemTypography(
    target: 'title' | 'description' | 'price' | 'ingredients',
    patch: Partial<MobileTypographyConfig>,
  ) {
    if (!selectedId) return;
    updateDoc((current) => ({
      ...current,
      components: current.components.map((component) => {
        if (component.id !== selectedId || component.type !== 'menuItem') return component;
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
    }));
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
    if (!selectedId) return;
    updateDoc((current) => ({
      ...current,
      components: current.components.map((component) => {
        if (component.id !== selectedId || component.type !== 'menuItem') return component;
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
  }

  function deleteSelected() {
    if (!selectedId) return;
    const id = selectedId;
    updateDoc((current) => ({
      ...current,
      components: current.components.filter((component) => component.id !== id),
    }));
    setSelectedId(null);
    if (isPhoneLayout) setPhoneSheet(null);
  }

  return (
    <div className={`mobile-editor-page${isPhoneLayout ? ' mobile-editor-page--phone' : ''}`}>
      <AppLayout />
      <main className="mobile-editor-main">
        <header className="mobile-editor-header">
          <h1>Editor móvil</h1>
          <div className="mobile-editor-header-actions">
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
                  onSelect={handleSelectComponent}
                  onReorder={handleReorderComponents}
                  animationPreview={animationPreview}
                />
              </div>
              <p className="panel-hint mobile-editor-desktop-only">
                {saving ? 'Guardando...' : 'Arrastra componentes en el móvil para reordenarlos · Autoguardado activo'}
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
              {!selected && <p className="panel-empty">Selecciona un componente en la carta.</p>}
              {selected && (
                <div className="mobile-props-form">
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
                      value={selected.animation?.preset ?? 'none'}
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
                      value={selected.animation?.trigger ?? 'on_view'}
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
                      disabled={(selected.animation?.preset ?? 'none') === 'none'}
                    >
                      Ver preview
                    </button>
                  </label>
                  {selected.type !== 'menuItem' && (
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
                      onChange={(e) => updateSelectedTypography({ color: e.target.value })}
                    />
                  </label>
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
                            updateSelectedMenuItemTypography(menuTypoTarget, { color: e.target.value })
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
                      value={selected.animation?.durationMs ?? 450}
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
                      value={selected.animation?.delayMs ?? 0}
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
                      value={selected.animation?.intensity ?? 1}
                      onChange={(e) => updateSelectedAnimation({ intensity: Number(e.target.value) })}
                    />
                  </label>
                  <h4>Efecto visual</h4>
                  <label>
                    Efecto
                    <select
                      value={selected.effect?.type ?? 'none'}
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
                  {(selected.effect?.type ?? 'none') !== 'none' && (
                    <>
                      <label>
                        Repetición
                        <select
                          value={selected.effect?.repeat ?? 'once'}
                          onChange={(e) => updateSelectedEffect({ repeat: e.target.value as MobileEffectRepeat })}
                        >
                          <option value="once">Una vez</option>
                          <option value="loop">En bucle</option>
                        </select>
                      </label>
                      <label>
                        Activación
                        <select
                          value={selected.effect?.trigger ?? 'on_view'}
                          onChange={(e) => updateSelectedEffect({ trigger: e.target.value as MobileEffectTrigger })}
                        >
                          <option value="on_view">Al ser visible</option>
                          <option value="on_load">Al cargar</option>
                          <option value="always">Siempre</option>
                        </select>
                      </label>
                      <label>
                        Duración (ms): {selected.effect?.durationMs ?? 600}
                        <input
                          type="range"
                          min={100}
                          max={3000}
                          step={50}
                          value={selected.effect?.durationMs ?? 600}
                          onChange={(e) => updateSelectedEffect({ durationMs: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        Retardo (ms): {selected.effect?.delayMs ?? 0}
                        <input
                          type="range"
                          min={0}
                          max={3000}
                          step={50}
                          value={selected.effect?.delayMs ?? 0}
                          onChange={(e) => updateSelectedEffect({ delayMs: Number(e.target.value) })}
                        />
                      </label>
                    </>
                  )}
                  <button type="button" className="danger" onClick={deleteSelected}>
                    Eliminar componente
                  </button>
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
        onClose={() => setStockModalOpen(false)}
        onSelect={(img) => {
          applyPickedImageUrl(img.fullUrl);
          setStockModalOpen(false);
        }}
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
        onAssetDeleted={(deleted) => {
          setAssets((prev) => prev.filter((a) => a.id !== deleted.id));
        }}
      />
    </div>
  );
}
