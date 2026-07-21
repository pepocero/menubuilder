import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { FabricObject, FabricImage } from 'fabric';
import type { StockImage } from '@shared/stock';
import type { CanvasData, MenuPage } from '@/types/canvas';
import {
  createBlankPage,
  normalizeCanvasData,
  serializeCanvasData,
} from '@/types/canvas';
import {
  ApiError,
  deleteAsset,
  getMenu,
  importStockImage,
  updateMenu,
  uploadAsset,
} from '@/lib/api';
import {
  addLayerToCanvas,
  createShapeLayer,
  createTextLayer,
  ensureA4Canvas,
  fitImageToA4,
  imageLayerToFabricObject,
  isImageObject,
} from '@/lib/canvas-serializer';
import { compressImage, dataUrlToBlob, generateThumbnail } from '@/lib/image-compress';
import {
  canRedoHistory,
  canUndoHistory,
  createPageHistory,
  pushHistoryState,
  redoHistory,
  undoHistory,
  type PageHistoryState,
} from '@/lib/canvas-history';
import { applyMenuImportToCanvas, recognizeMenuImage, resolveOcrLanguages } from '@/lib/menu-image-import';
import { exportMenuDocumentJson, exportPagesToPdf } from '@/lib/export';
import { preloadCommonEditorFonts } from '@/lib/google-fonts';
import { isLayerLocked, setLayerObjectData } from '@/lib/layer-utils';
import { CanvasEditor, type CanvasEditorHandle } from '@/components/editor/Canvas';
import { EditorZoomControls } from '@/components/editor/EditorZoomControls';
import { LayersPanel } from '@/components/editor/LayersPanel';
import { PropertiesPanel } from '@/components/editor/PropertiesPanel';
import { PublishQrModal } from '@/components/editor/PublishQrModal';
import { AssetManagerModal } from '@/components/editor/AssetManagerModal';
import { ImportMenuModal, type ImportMenuOptions, type ImportMenuSource } from '@/components/editor/ImportMenuModal';
import { StockImageSearch } from '@/components/editor/StockImageSearch';
import { Toolbar, type UploadProgressState } from '@/components/editor/Toolbar';

export function EditorPage() {
  const { menuId } = useParams<{ menuId: string }>();
  const navigate = useNavigate();
  const pageRefs = useRef<(CanvasEditorHandle | null)[]>([]);

  const [title, setTitle] = useState('');
  const [pages, setPages] = useState<MenuPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [activeObject, setActiveObject] = useState<FabricObject | null>(null);
  const [objects, setObjects] = useState<FabricObject[]>([]);
  const [stockOpen, setStockOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [stockBusy, setStockBusy] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [publicSlug, setPublicSlug] = useState<string | null>(null);
  const [editorError, setEditorError] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#FAF6F0');
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);
  const uploadInFlightRef = useRef(false);
  const [mobilePanel, setMobilePanel] = useState<'canvas' | 'layers' | 'props'>('canvas');
  const [zoom, setZoom] = useState(100);
  const [historyVersion, setHistoryVersion] = useState(0);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasAreaRef = useRef<HTMLElement | null>(null);
  const historyByPageIdRef = useRef<Map<string, PageHistoryState>>(new Map());
  const isRestoringHistoryRef = useRef(false);
  const activePageIndexRef = useRef(activePageIndex);
  activePageIndexRef.current = activePageIndex;
  const titleRef = useRef(title);
  titleRef.current = title;
  const pagesMetaRef = useRef(pages);
  pagesMetaRef.current = pages;
  const handleDeleteRef = useRef<(obj: FabricObject) => Promise<void>>(async () => {});

  const getActiveHandle = useCallback(
    () => pageRefs.current[activePageIndex] ?? null,
    [activePageIndex],
  );

  const getActiveCanvas = useCallback(
    () => getActiveHandle()?.getCanvas() ?? null,
    [getActiveHandle],
  );

  const collectDocument = useCallback((): CanvasData => {
    const collected: MenuPage[] = pagesMetaRef.current.map((page, index) => {
      const fromCanvas = pageRefs.current[index]?.getPageData();
      return fromCanvas ?? page;
    });
    return serializeCanvasData({
      width: 595,
      height: 842,
      pages: collected.length > 0 ? collected : [createBlankPage()],
    });
  }, []);

  const [objectsTick, setObjectsTick] = useState(0);

  const refreshObjects = useCallback(() => {
    const canvas = getActiveCanvas();
    if (canvas) {
      setObjects([...canvas.getObjects()]);
      const bg = canvas.backgroundColor;
      if (typeof bg === 'string') setBackgroundColor(bg);
      setObjectsTick((t) => t + 1);
    } else {
      setObjects([]);
    }
  }, [getActiveCanvas]);

  const scheduleSave = useCallback(() => {
    setSaveStatus('unsaved');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      if (!menuId) return;
      setSaveStatus('saving');
      try {
        const data = collectDocument();
        setPages(data.pages);

        let thumbnailUrl: string | null = null;
        const firstPng = pageRefs.current[0]?.exportPng();
        if (firstPng) {
          thumbnailUrl = await generateThumbnail(firstPng);
        }

        await updateMenu(menuId, {
          title: titleRef.current,
          canvas_data: data,
          thumbnail_url: thumbnailUrl,
        });
        setSaveStatus('saved');
        setEditorError('');
      } catch (err) {
        setSaveStatus('unsaved');
        if (err instanceof ApiError && err.status === 401) {
          setEditorError('Sesión expirada. Vuelve a iniciar sesión para guardar los cambios.');
        } else if (err instanceof ApiError) {
          setEditorError(`No se pudo guardar: ${err.message}`);
        } else {
          setEditorError('No se pudieron guardar los cambios. Revisa la conexión e inténtalo de nuevo.');
        }
      }
    }, 2500);
  }, [menuId, collectDocument]);

  const bumpHistoryUi = useCallback(() => {
    setHistoryVersion((v) => v + 1);
  }, []);

  const recordHistoryForPage = useCallback(
    (pageIndex: number) => {
      if (isRestoringHistoryRef.current) return;

      const pageId = pagesMetaRef.current[pageIndex]?.id;
      if (!pageId) return;

      const snapshot = pageRefs.current[pageIndex]?.getPageData();
      if (!snapshot) return;

      const prev = historyByPageIdRef.current.get(pageId);
      // Sin baseline sembrada, el primer snapshot se convertiría en el único estado
      // y un deshacer podría saltar a vacío. Sembrar antes de empujar cambios.
      const base = prev ?? createPageHistory(snapshot);
      if (!prev) {
        historyByPageIdRef.current.set(pageId, base);
        bumpHistoryUi();
        return;
      }

      const next = pushHistoryState(base, snapshot);
      historyByPageIdRef.current.set(pageId, next);
      bumpHistoryUi();
    },
    [bumpHistoryUi],
  );

  const seedHistoryForPage = useCallback(
    (pageIndex: number) => {
      const pageId = pagesMetaRef.current[pageIndex]?.id;
      if (!pageId) return;
      if (historyByPageIdRef.current.has(pageId)) return;

      const snapshot =
        pageRefs.current[pageIndex]?.getPageData() ?? pagesMetaRef.current[pageIndex];
      if (!snapshot) return;

      historyByPageIdRef.current.set(pageId, createPageHistory(snapshot));
      bumpHistoryUi();
    },
    [bumpHistoryUi],
  );

  const restorePageState = useCallback(
    async (pageIndex: number, state: MenuPage) => {
      isRestoringHistoryRef.current = true;
      try {
        await pageRefs.current[pageIndex]?.loadPage(state);
        setPages((prev) => prev.map((p, i) => (i === pageIndex ? state : p)));
        setActiveObject(null);
        refreshObjects();
        scheduleSave();
      } finally {
        isRestoringHistoryRef.current = false;
        bumpHistoryUi();
      }
    },
    [refreshObjects, scheduleSave, bumpHistoryUi],
  );

  const handleUndo = useCallback(async () => {
    const pageIndex = activePageIndexRef.current;
    const pageId = pagesMetaRef.current[pageIndex]?.id;
    if (!pageId) return;

    const current = historyByPageIdRef.current.get(pageId);
    if (!current || !canUndoHistory(current)) return;

    const { history, state } = undoHistory(current);
    if (!state) return;

    historyByPageIdRef.current.set(pageId, history);
    await restorePageState(pageIndex, state);
  }, [restorePageState]);

  const handleRedo = useCallback(async () => {
    const pageIndex = activePageIndexRef.current;
    const pageId = pagesMetaRef.current[pageIndex]?.id;
    if (!pageId) return;

    const current = historyByPageIdRef.current.get(pageId);
    if (!current || !canRedoHistory(current)) return;

    const { history, state } = redoHistory(current);
    if (!state) return;

    historyByPageIdRef.current.set(pageId, history);
    await restorePageState(pageIndex, state);
  }, [restorePageState]);

  const activePageHistory = pages[activePageIndex]
    ? historyByPageIdRef.current.get(pages[activePageIndex].id)
    : undefined;
  const canUndo = activePageHistory ? canUndoHistory(activePageHistory) : false;
  const canRedo = activePageHistory ? canRedoHistory(activePageHistory) : false;
  void historyVersion;

  useEffect(() => {
    preloadCommonEditorFonts();
  }, []);

  useEffect(() => {
    const area = canvasAreaRef.current;
    if (!area) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((current) => {
        const delta = event.deltaY > 0 ? -10 : 10;
        return Math.min(200, Math.max(25, current + delta));
      });
    };

    area.addEventListener('wheel', onWheel, { passive: false });
    return () => area.removeEventListener('wheel', onWheel);
  }, [loading, pages.length]);

  useEffect(() => {
    if (!menuId) return;
    historyByPageIdRef.current.clear();
    bumpHistoryUi();
    getMenu(menuId)
      .then(({ menu }) => {
        setTitle(menu.title);
        const doc = normalizeCanvasData(menu.canvas_data);
        setPages(doc.pages);
        setActivePageIndex(0);
        setIsPublic(menu.is_public);
        setPublicSlug(menu.public_slug);
        const firstBg = doc.pages[0]?.background;
        setBackgroundColor(
          firstBg?.type === 'color' ? firstBg.value : '#FAF6F0',
        );
      })
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false));
  }, [menuId, navigate, bumpHistoryUi]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (historyRecordTimerRef.current) clearTimeout(historyRecordTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => refreshObjects(), 200);
    return () => clearTimeout(timer);
  }, [activePageIndex, pages.length, refreshObjects]);

  const handleChange = useCallback(() => {
    refreshObjects();
    if (historyRecordTimerRef.current) {
      clearTimeout(historyRecordTimerRef.current);
    }
    historyRecordTimerRef.current = setTimeout(() => {
      recordHistoryForPage(activePageIndexRef.current);
    }, 400);
    scheduleSave();
  }, [refreshObjects, scheduleSave, recordHistoryForPage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (target?.isContentEditable) return;

      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;
      const isArrow = (arrowKeys as readonly string[]).includes(event.key);
      const mod = event.ctrlKey || event.metaKey;

      if (isArrow && !mod) {
        const canvas = getActiveCanvas();
        const obj = canvas?.getActiveObject() ?? null;
        if (!canvas || !obj) return;

        // En edición de texto, las flechas mueven el cursor
        if ((obj as FabricObject & { isEditing?: boolean }).isEditing) return;
        if (isLayerLocked(obj)) return;

        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (event.key === 'ArrowLeft') dx = -step;
        if (event.key === 'ArrowRight') dx = step;
        if (event.key === 'ArrowUp') dy = -step;
        if (event.key === 'ArrowDown') dy = step;

        obj.set({
          left: (obj.left ?? 0) + dx,
          top: (obj.top ?? 0) + dy,
        });
        obj.setCoords();
        canvas.requestRenderAll();
        handleChange();
        return;
      }

      if (!mod) return;

      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        void handleUndo();
        return;
      }

      if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) {
        event.preventDefault();
        void handleRedo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, getActiveCanvas, handleChange]);

  function handleActivatePage(index: number) {
    if (index === activePageIndex) return;
    // Deseleccionar en la página anterior
    pageRefs.current[activePageIndex]?.getCanvas()?.discardActiveObject();
    pageRefs.current[activePageIndex]?.getCanvas()?.requestRenderAll();
    setActivePageIndex(index);
    setActiveObject(null);
  }

  function handleAddPage() {
    const newPage = createBlankPage(backgroundColor);
    setPages((prev) => [...prev, newPage]);
    setActivePageIndex(pages.length);
    setActiveObject(null);
    scheduleSave();
  }

  function handleDeletePage() {
    if (pages.length <= 1) return;
    if (!confirm(`¿Eliminar la página ${activePageIndex + 1}?`)) return;

    const removedPageId = pages[activePageIndex]?.id;
    const next = pages.filter((_, i) => i !== activePageIndex);
    pageRefs.current = pageRefs.current.filter((_, i) => i !== activePageIndex);
    if (removedPageId) {
      historyByPageIdRef.current.delete(removedPageId);
      bumpHistoryUi();
    }
    setPages(next);
    setActivePageIndex(Math.min(activePageIndex, next.length - 1));
    setActiveObject(null);
    scheduleSave();
  }

  function handleClearCanvas() {
    const canvas = getActiveCanvas();
    if (!canvas) return;

    const objectCount = canvas.getObjects().length;
    const hasBgImage = !!canvas.backgroundImage;
    if (objectCount === 0 && !hasBgImage) return;

    if (
      !confirm(
        `¿Limpiar el lienzo de la página ${activePageIndex + 1}?\n\nSe eliminarán todas las capas. El color de fondo se mantiene. Puedes deshacer con Ctrl+Z.`,
      )
    ) {
      return;
    }

    canvas.discardActiveObject();
    canvas.remove(...canvas.getObjects());
    canvas.backgroundImage = undefined;
    if (typeof canvas.backgroundColor !== 'string' || !canvas.backgroundColor) {
      canvas.backgroundColor = backgroundColor || '#FAF6F0';
    }
    canvas.requestRenderAll();
    setActiveObject(null);
    handleChange();
  }

  async function handleAddText() {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    await addLayerToCanvas(canvas, createTextLayer());
    setActiveObject(canvas.getActiveObject() ?? null);
    handleChange();
  }

  async function handleAddShape(shape: 'rect' | 'line' | 'circle') {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    await addLayerToCanvas(canvas, createShapeLayer(shape));
    setActiveObject(canvas.getActiveObject() ?? null);
    handleChange();
  }

  async function handleUploadImage(file: File) {
    const canvas = getActiveCanvas();
    if (!canvas || uploadInFlightRef.current) return;
    uploadInFlightRef.current = true;
    setEditorError('');

    /** Progreso global: comprimir 0–35, subir 35–90, colocar 90–100 */
    const setPhase = (phase: UploadProgressState['phase'], localPercent: number) => {
      const clamped = Math.max(0, Math.min(100, localPercent));
      let overall = 0;
      if (phase === 'compress') overall = Math.round(clamped * 0.35);
      else if (phase === 'upload') overall = Math.round(35 + clamped * 0.55);
      else overall = Math.round(90 + clamped * 0.1);
      setUploadProgress({ phase, percent: Math.max(0, Math.min(100, overall)) });
    };

    try {
      setPhase('compress', 0);
      const compressed = await compressImage(file, (p) => setPhase('compress', p));

      setPhase('upload', 0);
      const { asset } = await uploadAsset(compressed, (p) => setPhase('upload', p));

      setPhase('place', 20);
      const layer = {
        id: `layer_${crypto.randomUUID().slice(0, 8)}`,
        type: 'image' as const,
        src: asset.url,
        x: 80,
        y: 120,
        width: 220,
        height: 220,
        rotation: 0,
        zIndex: canvas.getObjects().length + 1,
      };

      const img = await imageLayerToFabricObject(layer);
      setPhase('place', 70);
      (img as FabricObject & { data?: Record<string, unknown> }).data = {
        ...((img as FabricObject & { data?: Record<string, unknown> }).data ?? {}),
        assetId: asset.id,
        src: asset.url,
        layerType: 'image',
        layerId: layer.id,
      };
      canvas.add(img);
      fitImageToA4(img, canvas, 'cover');
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
      setActiveObject(img);
      setPhase('place', 100);
      handleChange();
    } catch (err) {
      setEditorError(err instanceof ApiError ? err.message : 'No se pudo subir la imagen');
    } finally {
      uploadInFlightRef.current = false;
      setUploadProgress(null);
    }
  }

  async function handleImportFromImage(source: ImportMenuSource, options: ImportMenuOptions) {
    const canvas = getActiveCanvas();
    if (!canvas || uploadInFlightRef.current) return;
    uploadInFlightRef.current = true;
    setEditorError('');
    setImportOpen(false);

    const setImportPhase = (
      phase: UploadProgressState['phase'],
      localPercent: number,
    ) => {
      const clamped = Math.max(0, Math.min(100, localPercent));
      let overall = 0;
      if (phase === 'compress') overall = Math.round(clamped * 0.12);
      else if (phase === 'ocr') overall = Math.round(12 + clamped * 0.58);
      else if (phase === 'upload') overall = Math.round(70 + clamped * 0.22);
      else overall = Math.round(92 + clamped * 0.08);
      setUploadProgress({ phase, percent: Math.max(0, Math.min(100, overall)) });
    };

    try {
      ensureA4Canvas(canvas);

      let ocrInput: Blob;
      let assetId: string;
      let imageUrl: string;

      if (source.type === 'asset') {
        if (!source.asset.url) {
          throw new Error('El archivo seleccionado no tiene URL válida');
        }
        setImportPhase('ocr', 0);
        const response = await fetch(source.asset.url, { credentials: 'include' });
        if (!response.ok) {
          throw new Error('No se pudo cargar la imagen desde tus archivos');
        }
        ocrInput = await response.blob();
        assetId = source.asset.id;
        imageUrl = source.asset.url;
      } else {
        ocrInput = source.file;
        assetId = '';
        imageUrl = '';
      }

      // OCR sobre el original (sin comprimir): la compresión agresiva empeora el reconocimiento.
      const ocrResult = await recognizeMenuImage(
        ocrInput,
        (p) => setImportPhase('ocr', p),
        resolveOcrLanguages(options.ocrLanguage),
      );

      if (ocrResult.lines.length === 0) {
        throw new Error(
          'No se detectó texto legible en la imagen. Prueba con una foto más nítida, sin ángulo extremo y con buen contraste.',
        );
      }

      if (source.type === 'file') {
        setImportPhase('compress', 0);
        const compressed = await compressImage(source.file, (p) => setImportPhase('compress', p));

        setImportPhase('upload', 0);
        const { asset } = await uploadAsset(compressed, (p) => setImportPhase('upload', p));
        assetId = asset.id;
        imageUrl = asset.url;
      } else {
        // Reutiliza el asset existente: no vuelve a subirse a R2
        setImportPhase('upload', 100);
      }

      setImportPhase('import', 20);
      const textCount = await applyMenuImportToCanvas(canvas, {
        imageUrl,
        assetId,
        lines: ocrResult.lines,
        imageWidth: ocrResult.imageWidth,
        imageHeight: ocrResult.imageHeight,
        groupByTitles: options.groupByTitles,
      });

      setImportPhase('import', 100);
      setActiveObject(null);
      refreshObjects();
      handleChange();

      setEditorError('');
      const modeHint = options.groupByTitles
        ? 'agrupadas por títulos (título + contenido por sección)'
        : 'una por cada línea detectada';
      alert(
        `Importación completada: ${textCount} capas de texto (${modeHint}). Revisa y ajusta antes de guardar.`,
      );
    } catch (err) {
      setEditorError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo importar la carta desde la imagen',
      );
    } finally {
      uploadInFlightRef.current = false;
      setUploadProgress(null);
    }
  }

  async function handleFitImageToA4() {
    const canvas = getActiveCanvas();
    if (!canvas || !activeObject || !isImageObject(activeObject)) return;
    ensureA4Canvas(canvas);
    fitImageToA4(activeObject as FabricImage, canvas, 'cover');
    handleChange();
  }

  function assetUrlMatches(layerSrc: string | undefined, assetUrl: string | null): boolean {
    if (!layerSrc || !assetUrl) return false;
    if (layerSrc === assetUrl) return true;
    try {
      const a = decodeURIComponent(layerSrc);
      const b = decodeURIComponent(assetUrl);
      return a === b;
    } catch {
      return false;
    }
  }

  async function handleAssetDeletedFromManager(asset: { id: string; url: string | null }) {
    const doc = collectDocument();
    let changed = false;

    const nextPages = doc.pages.map((page) => {
      const layers = page.layers.filter((layer) => {
        if (layer.type !== 'image') return true;
        if (asset.id && (layer as { assetId?: string }).assetId === asset.id) {
          changed = true;
          return false;
        }
        if (assetUrlMatches(layer.src, asset.url)) {
          changed = true;
          return false;
        }
        return true;
      });

      let background = page.background;
      if (
        background.type === 'image' &&
        assetUrlMatches(background.value, asset.url)
      ) {
        background = { type: 'color', value: '#FAF6F0' };
        changed = true;
      }

      if (layers.length === page.layers.length && background === page.background) {
        return page;
      }
      return { ...page, layers, background };
    });

    if (!changed) return;

    setPages(nextPages);
    setActiveObject(null);

    for (let i = 0; i < nextPages.length; i++) {
      const handle = pageRefs.current[i];
      if (handle) {
        await handle.loadPage(nextPages[i]);
      }
    }

    refreshObjects();
    scheduleSave();
  }

  async function handleStockSelect(image: StockImage) {
    const canvas = getActiveCanvas();
    if (!canvas || stockBusy) return;

    setStockBusy(true);
    setEditorError('');
    try {
      const { asset } = await importStockImage({
        stockImageId: image.id,
        fullUrl: image.fullUrl,
        provider: image.provider,
      });

      const maxW = 280;
      const ratio = image.height / Math.max(image.width, 1);
      const layer = {
        id: `layer_${crypto.randomUUID().slice(0, 8)}`,
        type: 'image' as const,
        src: asset.url,
        x: 100,
        y: 150,
        width: maxW,
        height: Math.round(maxW * ratio),
        rotation: 0,
        zIndex: canvas.getObjects().length + 1,
      };

      const img = await imageLayerToFabricObject(layer);
      (img as FabricObject & { data?: Record<string, unknown> }).data = {
        ...((img as FabricObject & { data?: Record<string, unknown> }).data ?? {}),
        assetId: asset.id,
        src: asset.url,
        layerType: 'image',
        layerId: layer.id,
      };
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
      setActiveObject(img);
      setStockOpen(false);
      handleChange();
    } catch (err) {
      console.error(err);
      setEditorError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo añadir la imagen de stock al lienzo',
      );
      setStockOpen(false);
    } finally {
      setStockBusy(false);
    }
  }

  function handleChangeBackground(color: string) {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    canvas.backgroundColor = color;
    canvas.requestRenderAll();
    setBackgroundColor(color);
    handleChange();
  }

  function handleExportPng() {
    const dataUrl = getActiveHandle()?.exportPng();
    if (!dataUrl) return;
    const blob = dataUrlToBlob(dataUrl);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'menu'}-p${activePageIndex + 1}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportPdf() {
    const urls = pageRefs.current
      .map((ref) => ref?.exportPng())
      .filter((u): u is string => !!u);
    if (urls.length === 0) return;
    exportPagesToPdf(urls, title || 'carta-menu');
  }

  function handleExportJson() {
    const data = collectDocument();
    exportMenuDocumentJson(data, title || 'menu', title || undefined);
  }

  function handleSelectObject(obj: FabricObject) {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
    setActiveObject(obj);
  }

  function handleMoveUp(obj: FabricObject) {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    canvas.bringObjectForward(obj);
    canvas.requestRenderAll();
    refreshObjects();
    scheduleSave();
  }

  function handleMoveDown(obj: FabricObject) {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    canvas.sendObjectBackwards(obj);
    canvas.requestRenderAll();
    refreshObjects();
    scheduleSave();
  }

  function handleToggleVisibility(obj: FabricObject) {
    obj.set('visible', obj.visible === false);
    obj.canvas?.requestRenderAll();
    refreshObjects();
    scheduleSave();
  }

  function handleToggleLock(obj: FabricObject) {
    const nextLocked = !isLayerLocked(obj);
    obj.set({ selectable: !nextLocked, evented: !nextLocked });
    setLayerObjectData(obj, { locked: nextLocked });
    obj.canvas?.requestRenderAll();
    refreshObjects();
    scheduleSave();
  }

  function handleRenameLayer(obj: FabricObject, name: string) {
    const trimmed = name.trim();
    setLayerObjectData(obj, { layerName: trimmed || undefined });
    refreshObjects();
    scheduleSave();
  }

  function handleZoomIn() {
    setZoom((z) => Math.min(200, z + 10));
  }

  function handleZoomOut() {
    setZoom((z) => Math.max(25, z - 10));
  }

  function handleZoomReset() {
    setZoom(100);
  }

  function handleZoomFit() {
    const area = canvasAreaRef.current;
    if (!area) {
      setZoom(100);
      return;
    }
    const available = area.clientWidth - 48;
    const fit = Math.min(200, Math.max(25, Math.round((available / 595) * 100)));
    setZoom(fit);
  }

  async function handleDuplicate(obj: FabricObject) {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const cloned = await obj.clone();
    cloned.set({
      left: (obj.left ?? 0) + 20,
      top: (obj.top ?? 0) + 20,
      originX: 'left',
      originY: 'top',
    });
    canvas.add(cloned);
    canvas.setActiveObject(cloned);
    canvas.requestRenderAll();
    setActiveObject(cloned);
    handleChange();
  }

  async function handleDelete(obj: FabricObject) {
    const canvas = getActiveCanvas();
    if (!canvas) return;

    const data = (obj as FabricObject & { data?: { src?: string; layerType?: string } }).data;
    const src =
      data?.src ??
      (isImageObject(obj) ? (obj as FabricImage).getSrc?.() : undefined);

    canvas.remove(obj);
    canvas.requestRenderAll();
    setActiveObject(null);
    handleChange();

    if (src && src.includes('/api/assets/file/')) {
      const stillUsedOnCanvas = canvas.getObjects().some((o) => {
        if (!isImageObject(o)) return false;
        const od = (o as FabricObject & { data?: { src?: string } }).data;
        const otherSrc = od?.src ?? (o as FabricImage).getSrc?.();
        return otherSrc === src;
      });

      // También en otras páginas del documento actual
      const doc = collectDocument();
      const usedInOtherPages = doc.pages.some((page, idx) => {
        if (idx === activePageIndex) return false;
        return page.layers.some((l) => l.type === 'image' && l.src === src);
      });

      if (!stillUsedOnCanvas && !usedInOtherPages && menuId) {
        try {
          await deleteAsset({ url: src, exclude_menu_id: menuId });
        } catch (err) {
          console.error('No se pudo eliminar el archivo de R2', err);
        }
      }
    }
  }
  handleDeleteRef.current = handleDelete;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (target?.isContentEditable) return;

      const canvas = getActiveCanvas();
      const obj = canvas?.getActiveObject() ?? null;
      if (!canvas || !obj) return;

      // En edición de texto, Backspace/Supr borran caracteres
      if ((obj as FabricObject & { isEditing?: boolean }).isEditing) return;
      if (isLayerLocked(obj)) return;

      event.preventDefault();
      void handleDeleteRef.current(obj);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [getActiveCanvas]);

  if (loading || pages.length === 0) {
    return (
      <div className="loading-screen">
        <p>Cargando editor...</p>
      </div>
    );
  }

  return (
    <div className="editor-page">
      <header className="editor-header">
        <Link to="/dashboard" className="back-link">
          ← Dashboard
        </Link>
        <input
          className="title-input"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleSave();
          }}
          placeholder="Título del menú"
        />
        <span className={`save-status save-status--${saveStatus}`}>
          {saveStatus === 'saved' && 'Guardado'}
          {saveStatus === 'saving' && 'Guardando...'}
          {saveStatus === 'unsaved' && 'Cambios sin guardar'}
        </span>
        <EditorZoomControls
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
          onZoomFit={handleZoomFit}
        />
      </header>

      {editorError && (
        <div className="error-banner editor-error-banner">
          {editorError}
          <button type="button" onClick={() => setEditorError('')}>
            Cerrar
          </button>
        </div>
      )}

      <Toolbar
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onClearCanvas={handleClearCanvas}
        canClearCanvas={objects.length > 0}
        onAddText={handleAddText}
        onAddRect={() => handleAddShape('rect')}
        onAddLine={() => handleAddShape('line')}
        onAddCircle={() => handleAddShape('circle')}
        onUploadImage={handleUploadImage}
        onOpenStock={() => setStockOpen(true)}
        onOpenImportMenu={() => setImportOpen(true)}
        onOpenAssets={() => setAssetsOpen(true)}
        onFitImageToA4={handleFitImageToA4}
        canFitImage={!!activeObject && isImageObject(activeObject)}
        onChangeBackground={handleChangeBackground}
        onExportPng={handleExportPng}
        onExportPdf={handleExportPdf}
        onExportJson={handleExportJson}
        onOpenQr={() => setQrOpen(true)}
        onAddPage={handleAddPage}
        onDeletePage={handleDeletePage}
        canDeletePage={pages.length > 1}
        pageIndex={activePageIndex}
        pageCount={pages.length}
        backgroundColor={backgroundColor}
        uploadProgress={uploadProgress}
      />

      <div className={`editor-workspace editor-workspace--${mobilePanel}`}>
        <aside className="editor-sidebar left">
          <LayersPanel
            objects={objects}
            objectsTick={objectsTick}
            activeObject={activeObject}
            onSelect={(obj) => {
              handleSelectObject(obj);
              setMobilePanel('canvas');
            }}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onToggleVisibility={handleToggleVisibility}
            onToggleLock={handleToggleLock}
            onRenameLayer={handleRenameLayer}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />
        </aside>

        <main className="editor-canvas-area" ref={canvasAreaRef}>
          <div className="pages-stack">
            {pages.map((page, index) => (
              <div key={page.id} className="page-block">
                <div className="page-label">
                  Página {index + 1}
                  {index === activePageIndex && <span className="page-label-active"> · editando</span>}
                </div>
                <CanvasEditor
                  ref={(handle) => {
                    pageRefs.current[index] = handle;
                  }}
                  pageId={page.id}
                  initialPage={page}
                  zoom={zoom}
                  active={index === activePageIndex}
                  onActivate={() => handleActivatePage(index)}
                  onSelectionChange={(obj) => {
                    handleActivatePage(index);
                    setActiveObject(obj);
                    if (obj) setMobilePanel('props');
                  }}
                  onChange={handleChange}
                  onReady={() => seedHistoryForPage(index)}
                />
              </div>
            ))}
          </div>
        </main>

        <aside className="editor-sidebar right">
          <PropertiesPanel activeObject={activeObject} onUpdate={handleChange} />
        </aside>
      </div>

      <nav className="editor-mobile-nav" aria-label="Paneles del editor">
        <button
          type="button"
          className={mobilePanel === 'layers' ? 'is-active' : undefined}
          onClick={() => setMobilePanel('layers')}
        >
          Capas
        </button>
        <button
          type="button"
          className={mobilePanel === 'canvas' ? 'is-active' : undefined}
          onClick={() => setMobilePanel('canvas')}
        >
          Lienzo
        </button>
        <button
          type="button"
          className={mobilePanel === 'props' ? 'is-active' : undefined}
          onClick={() => setMobilePanel('props')}
        >
          Propiedades
        </button>
      </nav>

      <AssetManagerModal
        open={assetsOpen}
        onClose={() => setAssetsOpen(false)}
        menuId={menuId}
        onAssetDeleted={(asset) => {
          void handleAssetDeletedFromManager(asset);
        }}
      />

      <ImportMenuModal
        open={importOpen}
        onClose={() => !uploadProgress && setImportOpen(false)}
        onImport={handleImportFromImage}
        busy={!!uploadProgress}
        pageIndex={activePageIndex}
      />

      <StockImageSearch
        open={stockOpen}
        onClose={() => !stockBusy && setStockOpen(false)}
        onSelect={handleStockSelect}
        busy={stockBusy}
      />

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
    </div>
  );
}
