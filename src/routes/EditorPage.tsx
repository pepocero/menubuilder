import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ActiveSelection, type FabricObject, type FabricImage } from 'fabric';
import type { StockImage } from '@shared/stock';
import type { CanvasData, CanvasLayer, MenuPage, PageScrollDirection } from '@/types/canvas';
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
  recognizeMenuWithVision,
  updateMenu,
  uploadAsset,
  type AssetSummary,
} from '@/lib/api';
import {
  clampActiveObjectsIntoPage,
  clampLayerIntoPage,
  transferObjectsBetweenPages,
  type PageSpillDirection,
} from '@/lib/transfer-page-objects';
import {
  addLayerToCanvas,
  createShapeLayer,
  createTextLayer,
  ensureA4Canvas,
  fabricObjectToLayer,
  fitImageToA4,
  getCanvasLogicalSize,
  imageLayerToFabricObject,
  isImageObject,
} from '@/lib/canvas-serializer';
import {
  canMergeSelectedTextLayers,
  getSelectedTextObjects,
  mergeSelectedTextLayers,
} from '@/lib/merge-text-layers';
import { compressImage, dataUrlToBlob, generateThumbnail } from '@/lib/image-compress';
import { getPageSize, ptToCm } from '@/lib/page-size';
import {
  canRedoHistory,
  canUndoHistory,
  createPageHistory,
  pushHistoryState,
  redoHistory,
  undoHistory,
  type PageHistoryState,
} from '@/lib/canvas-history';
import {
  applyVisionMenuImportToCanvas,
  prepareImageForVisionOcr,
} from '@/lib/vision-menu-import';
import {
  pickColorWithEyeDropper,
  sampleColorFromFabricCanvas,
  supportsNativeEyeDropper,
} from '@/lib/eyedropper';
import { exportMenuDocumentJson, exportPagesToPdf, parseMenuJsonFile } from '@/lib/export';
import { preloadCommonEditorFonts } from '@/lib/google-fonts';
import { ensureUniqueLayerIds, isLayerLocked, setLayerObjectData } from '@/lib/layer-utils';
import { CanvasEditor, type CanvasEditorHandle } from '@/components/editor/Canvas';
import { EditorZoomControls, type CanvasInteractionMode } from '@/components/editor/EditorZoomControls';
import { LayersPanel } from '@/components/editor/LayersPanel';
import { PropertiesPanel } from '@/components/editor/PropertiesPanel';
import { PageSizeControls } from '@/components/editor/PageSizeControls';
import { PublicScrollControls } from '@/components/editor/PublicScrollControls';
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
  const [pageScroll, setPageScroll] = useState<PageScrollDirection>('vertical');
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
  const [backgroundPickActive, setBackgroundPickActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);
  const uploadInFlightRef = useRef(false);
  const [mobilePanel, setMobilePanel] = useState<'canvas' | 'layers' | 'props'>('canvas');
  const [zoom, setZoom] = useState(100);
  const [interactionMode, setInteractionMode] = useState<CanvasInteractionMode>('move');
  const [historyVersion, setHistoryVersion] = useState(0);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasAreaRef = useRef<HTMLElement | null>(null);
  const historyByPageIdRef = useRef<Map<string, PageHistoryState>>(new Map());
  const isRestoringHistoryRef = useRef(false);
  /**
   * Traslado entre páginas: Deshacer/Rehacer debe restaurar origen y destino juntos.
   * Se invalida al editar una sola página después.
   */
  const transferHistoryLinkRef = useRef<{
    fromPageId: string;
    toPageId: string;
  } | null>(null);
  const transferRedoLinkRef = useRef<{
    fromPageId: string;
    toPageId: string;
  } | null>(null);
  const activePageIndexRef = useRef(activePageIndex);
  activePageIndexRef.current = activePageIndex;
  const titleRef = useRef(title);
  titleRef.current = title;
  const pagesMetaRef = useRef(pages);
  pagesMetaRef.current = pages;
  const handleDeleteRef = useRef<(obj: FabricObject) => Promise<void>>(async () => {});
  /** Portapapeles interno de capas (permite pegar en otra página). */
  const layerClipboardRef = useRef<{ layers: CanvasLayer[]; pasteCount: number }>({
    layers: [],
    pasteCount: 0,
  });
  const [clipboardLayerCount, setClipboardLayerCount] = useState(0);

  const getActiveHandle = useCallback(
    () => pageRefs.current[activePageIndex] ?? null,
    [activePageIndex],
  );

  const getActiveCanvas = useCallback(
    () => getActiveHandle()?.getCanvas() ?? null,
    [getActiveHandle],
  );

  const pageScrollRef = useRef<PageScrollDirection>('vertical');
  pageScrollRef.current = pageScroll;

  const collectDocument = useCallback((): CanvasData => {
    const collected: MenuPage[] = pagesMetaRef.current.map((page, index) => {
      const fromCanvas = pageRefs.current[index]?.getPageData();
      return fromCanvas ?? page;
    });
    return serializeCanvasData({
      width: 595,
      height: 842,
      pageScroll: pageScrollRef.current,
      pages: collected.length > 0 ? collected : [createBlankPage()],
    });
  }, []);

  const [objectsTick, setObjectsTick] = useState(0);

  const refreshObjects = useCallback(() => {
    const canvas = getActiveCanvas();
    if (canvas) {
      const objs = canvas.getObjects();
      if (ensureUniqueLayerIds(objs)) {
        canvas.requestRenderAll();
      }
      setObjects([...objs]);
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
        // No hacer setPages aquí: si el lienzo está a medias (load/dispose),
        // pisaba el estado con capas vacías y remountaba el editor en bucle.

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

  const pushHistoryImmediate = useCallback(
    (pageIndex: number, snapshot: MenuPage): boolean => {
      const pageId = pagesMetaRef.current[pageIndex]?.id;
      if (!pageId) return false;

      const prev = historyByPageIdRef.current.get(pageId);
      if (!prev) {
        historyByPageIdRef.current.set(pageId, createPageHistory(snapshot));
        bumpHistoryUi();
        return false;
      }

      const next = pushHistoryState(prev, snapshot);
      if (next === prev) return false;
      historyByPageIdRef.current.set(pageId, next);
      bumpHistoryUi();
      return true;
    },
    [bumpHistoryUi],
  );

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
      if (next !== base) {
        // Una edición local rompe el enlace de traslado entre páginas.
        transferHistoryLinkRef.current = null;
        transferRedoLinkRef.current = null;
      }
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

  const findPageIndexById = useCallback((pageId: string) => {
    return pagesMetaRef.current.findIndex((p) => p.id === pageId);
  }, []);

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

  const undoTransferLink = useCallback(
    async (link: { fromPageId: string; toPageId: string }) => {
      const fromIdx = findPageIndexById(link.fromPageId);
      const toIdx = findPageIndexById(link.toPageId);
      const fromHist = historyByPageIdRef.current.get(link.fromPageId);
      const toHist = historyByPageIdRef.current.get(link.toPageId);
      if (
        fromIdx < 0 ||
        toIdx < 0 ||
        !fromHist ||
        !toHist ||
        !canUndoHistory(fromHist) ||
        !canUndoHistory(toHist)
      ) {
        return false;
      }

      const fromUndo = undoHistory(fromHist);
      const toUndo = undoHistory(toHist);
      if (!fromUndo.state || !toUndo.state) return false;

      historyByPageIdRef.current.set(link.fromPageId, fromUndo.history);
      historyByPageIdRef.current.set(link.toPageId, toUndo.history);
      transferHistoryLinkRef.current = null;
      transferRedoLinkRef.current = link;

      await restorePageState(fromIdx, fromUndo.state);
      await restorePageState(toIdx, toUndo.state);
      activePageIndexRef.current = fromIdx;
      setActivePageIndex(fromIdx);
      setActiveObject(null);
      refreshObjects();
      return true;
    },
    [findPageIndexById, restorePageState, refreshObjects],
  );

  const redoTransferLink = useCallback(
    async (link: { fromPageId: string; toPageId: string }) => {
      const fromIdx = findPageIndexById(link.fromPageId);
      const toIdx = findPageIndexById(link.toPageId);
      const fromHist = historyByPageIdRef.current.get(link.fromPageId);
      const toHist = historyByPageIdRef.current.get(link.toPageId);
      if (
        fromIdx < 0 ||
        toIdx < 0 ||
        !fromHist ||
        !toHist ||
        !canRedoHistory(fromHist) ||
        !canRedoHistory(toHist)
      ) {
        return false;
      }

      const fromRedo = redoHistory(fromHist);
      const toRedo = redoHistory(toHist);
      if (!fromRedo.state || !toRedo.state) return false;

      historyByPageIdRef.current.set(link.fromPageId, fromRedo.history);
      historyByPageIdRef.current.set(link.toPageId, toRedo.history);
      transferRedoLinkRef.current = null;
      transferHistoryLinkRef.current = link;

      await restorePageState(fromIdx, fromRedo.state);
      await restorePageState(toIdx, toRedo.state);
      activePageIndexRef.current = toIdx;
      setActivePageIndex(toIdx);
      setActiveObject(null);
      refreshObjects();
      return true;
    },
    [findPageIndexById, restorePageState, refreshObjects],
  );

  const handleUndo = useCallback(async () => {
    const pageIndex = activePageIndexRef.current;
    const pageId = pagesMetaRef.current[pageIndex]?.id;
    if (!pageId) return;

    const transferLink = transferHistoryLinkRef.current;
    if (
      transferLink &&
      (pageId === transferLink.fromPageId || pageId === transferLink.toPageId)
    ) {
      const ok = await undoTransferLink(transferLink);
      if (ok) return;
    }

    const current = historyByPageIdRef.current.get(pageId);
    if (!current || !canUndoHistory(current)) return;

    const { history, state } = undoHistory(current);
    if (!state) return;

    historyByPageIdRef.current.set(pageId, history);
    transferRedoLinkRef.current = null;
    await restorePageState(pageIndex, state);
  }, [restorePageState, undoTransferLink]);

  const handleRedo = useCallback(async () => {
    const pageIndex = activePageIndexRef.current;
    const pageId = pagesMetaRef.current[pageIndex]?.id;
    if (!pageId) return;

    const transferLink = transferRedoLinkRef.current;
    if (
      transferLink &&
      (pageId === transferLink.fromPageId || pageId === transferLink.toPageId)
    ) {
      const ok = await redoTransferLink(transferLink);
      if (ok) return;
    }

    const current = historyByPageIdRef.current.get(pageId);
    if (!current || !canRedoHistory(current)) return;

    const { history, state } = redoHistory(current);
    if (!state) return;

    historyByPageIdRef.current.set(pageId, history);
    transferHistoryLinkRef.current = null;
    await restorePageState(pageIndex, state);
  }, [restorePageState, redoTransferLink]);

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
    transferHistoryLinkRef.current = null;
    transferRedoLinkRef.current = null;
    bumpHistoryUi();
    getMenu(menuId)
      .then(({ menu }) => {
        setTitle(menu.title);
        const doc = normalizeCanvasData(menu.canvas_data);
        setPages(doc.pages);
        setPageScroll(doc.pageScroll ?? 'vertical');
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

  // Al pasar a Scroll: soltar selección solo en la transición (no en cada render).
  const prevInteractionModeRef = useRef(interactionMode);
  useEffect(() => {
    const prev = prevInteractionModeRef.current;
    prevInteractionModeRef.current = interactionMode;
    if (interactionMode !== 'scroll' || prev === 'scroll') return;
    pageRefs.current.forEach((handle) => handle?.discardSelectionSilent());
    setActiveObject(null);
  }, [interactionMode]);

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
    if (!backgroundPickActive) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setBackgroundPickActive(false);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.editor-canvas-wrap')) return;

      const canvas = getActiveCanvas();
      if (!canvas) return;

      event.preventDefault();
      event.stopPropagation();
      const hex = sampleColorFromFabricCanvas(canvas, event.clientX, event.clientY);
      if (!hex) {
        setEditorError(
          'No se pudo leer el color (la imagen puede bloquear el muestreo). Prueba Chrome o Edge con el cuentagotas nativo.',
        );
        setBackgroundPickActive(false);
        return;
      }
      canvas.backgroundColor = hex;
      canvas.requestRenderAll();
      setBackgroundColor(hex);
      setBackgroundPickActive(false);
      handleChange();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [backgroundPickActive, getActiveCanvas, handleChange]);

  const handleCopyLayers = useCallback((): boolean => {
    const canvas = getActiveCanvas();
    if (!canvas) return false;
    const active = canvas.getActiveObject();
    if (!active) return false;
    // En edición de texto, dejar que el navegador copie el texto seleccionado.
    if ((active as FabricObject & { isEditing?: boolean }).isEditing) return false;

    let objects: FabricObject[];
    let restore: FabricObject[] | null = null;

    if (active instanceof ActiveSelection) {
      restore = [...active.getObjects()];
      canvas.discardActiveObject();
      objects = restore.filter((o) => canvas.getObjects().includes(o));
    } else {
      objects = [active];
    }

    const layers: CanvasLayer[] = [];
    for (let i = 0; i < objects.length; i++) {
      const layer = fabricObjectToLayer(objects[i], i + 1);
      if (layer) layers.push(structuredClone(layer));
    }

    if (restore && restore.length > 0) {
      if (restore.length === 1) {
        canvas.setActiveObject(restore[0]);
      } else {
        canvas.setActiveObject(new ActiveSelection(restore, { canvas }));
      }
      canvas.requestRenderAll();
    }

    if (layers.length === 0) return false;
    layerClipboardRef.current = { layers, pasteCount: 0 };
    setClipboardLayerCount(layers.length);
    return true;
  }, [getActiveCanvas]);

  const handlePasteLayers = useCallback(async () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active && (active as FabricObject & { isEditing?: boolean }).isEditing) {
      return;
    }

    const clip = layerClipboardRef.current;
    if (clip.layers.length === 0) return;

    clip.pasteCount += 1;
    const offset = 20 * clip.pasteCount;
    const added: FabricObject[] = [];
    const pageSize = getCanvasLogicalSize(canvas);

    for (const layer of clip.layers) {
      const copy = structuredClone(layer);
      copy.id = `layer_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
      copy.x = (copy.x ?? 0) + offset;
      copy.y = (copy.y ?? 0) + offset;
      const clamped = clampLayerIntoPage(copy, pageSize.width, pageSize.height);
      await addLayerToCanvas(canvas, clamped);
      const sel = canvas.getActiveObject();
      if (sel && !added.includes(sel)) added.push(sel);
    }

    if (added.length > 1) {
      canvas.setActiveObject(new ActiveSelection(added, { canvas }));
    } else if (added.length === 1) {
      canvas.setActiveObject(added[0]);
    }
    clampActiveObjectsIntoPage(canvas);
    canvas.requestRenderAll();
    setActiveObject(canvas.getActiveObject() ?? null);
    handleChange();
  }, [getActiveCanvas, handleChange]);

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
        clampActiveObjectsIntoPage(canvas);
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
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'c') {
        if (handleCopyLayers()) event.preventDefault();
        return;
      }

      if (key === 'v') {
        if (layerClipboardRef.current.layers.length === 0) return;
        const canvas = getActiveCanvas();
        const obj = canvas?.getActiveObject() ?? null;
        if (obj && (obj as FabricObject & { isEditing?: boolean }).isEditing) return;
        event.preventDefault();
        void handlePasteLayers();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleUndo,
    handleRedo,
    getActiveCanvas,
    handleChange,
    handleCopyLayers,
    handlePasteLayers,
  ]);

  function handleActivatePage(index: number) {
    if (index === activePageIndexRef.current) return;
    activePageIndexRef.current = index;
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

  function handleDeletePage(pageIndex?: number) {
    const index =
      typeof pageIndex === 'number' && Number.isFinite(pageIndex)
        ? pageIndex
        : activePageIndexRef.current;
    if (pages.length <= 1) return;
    if (index < 0 || index >= pages.length) return;
    if (!confirm(`¿Eliminar la página ${index + 1}?`)) return;

    const removedPageId = pages[index]?.id;
    const next = pages.filter((_, i) => i !== index);
    pageRefs.current = pageRefs.current.filter((_, i) => i !== index);
    if (removedPageId) {
      historyByPageIdRef.current.delete(removedPageId);
      bumpHistoryUi();
    }
    setPages(next);
    const currentActive = activePageIndexRef.current;
    let nextActive = currentActive;
    if (currentActive === index) {
      nextActive = Math.min(index, next.length - 1);
    } else if (currentActive > index) {
      nextActive = currentActive - 1;
    }
    setActivePageIndex(nextActive);
    setActiveObject(null);
    scheduleSave();
  }

  /** Reordena páginas; el historial va por id de página, no por índice. */
  function handleMovePage(from: number, to: number) {
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= pages.length ||
      to >= pages.length
    ) {
      return;
    }

    setPages((prev) => {
      const next = [...prev];
      const [page] = next.splice(from, 1);
      next.splice(to, 0, page);
      return next;
    });

    const refs = [...pageRefs.current];
    const [handle] = refs.splice(from, 1);
    refs.splice(to, 0, handle ?? null);
    pageRefs.current = refs;

    let nextActive = activePageIndexRef.current;
    if (nextActive === from) nextActive = to;
    else if (from < nextActive && to >= nextActive) nextActive -= 1;
    else if (from > nextActive && to <= nextActive) nextActive += 1;
    activePageIndexRef.current = nextActive;
    setActivePageIndex(nextActive);
    scheduleSave();
  }

  function handleMovePageUp(index = activePageIndexRef.current) {
    handleMovePage(index, index - 1);
  }

  function handleMovePageDown(index = activePageIndexRef.current) {
    handleMovePage(index, index + 1);
  }

  async function handleTransferSelectionToPage(
    toIndex: number,
    fromSpill = false,
  ) {
    const fromIndex = activePageIndexRef.current;
    if (
      toIndex === fromIndex ||
      toIndex < 0 ||
      toIndex >= pagesMetaRef.current.length
    ) {
      return;
    }

    const fromCanvas = pageRefs.current[fromIndex]?.getCanvas() ?? null;
    const toCanvas = pageRefs.current[toIndex]?.getCanvas() ?? null;
    if (!fromCanvas || !toCanvas) return;

    const fromPageId = pagesMetaRef.current[fromIndex]?.id;
    const toPageId = pagesMetaRef.current[toIndex]?.id;
    if (!fromPageId || !toPageId) return;

    // Baseline en ambas páginas antes del traslado (para poder deshacer).
    const fromBefore = pageRefs.current[fromIndex]?.getPageData();
    const toBefore = pageRefs.current[toIndex]?.getPageData();
    if (fromBefore) pushHistoryImmediate(fromIndex, fromBefore);
    if (toBefore) pushHistoryImmediate(toIndex, toBefore);

    const direction: PageSpillDirection =
      toIndex > fromIndex ? 'next' : 'prev';

    const added = await transferObjectsBetweenPages({
      fromCanvas,
      toCanvas,
      direction,
      fromSpill,
    });
    if (added.length === 0) return;

    const fromAfter = pageRefs.current[fromIndex]?.getPageData();
    const toAfter = pageRefs.current[toIndex]?.getPageData();
    if (fromAfter) pushHistoryImmediate(fromIndex, fromAfter);
    if (toAfter) pushHistoryImmediate(toIndex, toAfter);

    transferHistoryLinkRef.current = { fromPageId, toPageId };
    transferRedoLinkRef.current = null;

    handleActivatePage(toIndex);
    setActiveObject(toCanvas.getActiveObject() ?? added[0] ?? null);
    refreshObjects();
    // No usar handleChange(): el historial ya está en ambas páginas.
    scheduleSave();
    bumpHistoryUi();

    requestAnimationFrame(() => {
      const block = document.querySelectorAll('.page-block')[toIndex];
      block?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  async function handleTransferSelectionToAdjacentPage(
    direction: PageSpillDirection,
    fromSpill = false,
  ) {
    const fromIndex = activePageIndexRef.current;
    const toIndex = direction === 'next' ? fromIndex + 1 : fromIndex - 1;
    await handleTransferSelectionToPage(toIndex, fromSpill);
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

  function handleMergeTexts() {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const merged = mergeSelectedTextLayers(canvas);
    if (!merged) return;
    setInteractionMode('move');
    setActiveObject(merged);
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
    // Mantener el modal abierto y bloqueante mientras la IA trabaja.
    setUploadProgress({ phase: 'ocr', percent: 1 });

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

      let sourceBlob: Blob;
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
        sourceBlob = await response.blob();
        assetId = source.asset.id;
        imageUrl = source.asset.url;
      } else {
        sourceBlob = source.file;
        assetId = '';
        imageUrl = '';
      }

      setImportPhase('ocr', 2);
      const visionInput = await prepareImageForVisionOcr(sourceBlob);
      const { menu } = await recognizeMenuWithVision(visionInput, {
        provider: options.provider,
        promptExtra: options.promptExtra,
        onProgress: (p) => setImportPhase('ocr', p),
      });

      if (!menu.headerTitle && menu.sections.length === 0) {
        throw new Error(
          'No se detectó texto legible en la imagen. Prueba con una foto más nítida y buen contraste.',
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
        setImportPhase('upload', 100);
      }

      const dimsUrl = URL.createObjectURL(sourceBlob);
      let imageWidth = 595;
      let imageHeight = 842;
      try {
        const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => reject(new Error('No se pudieron leer las dimensiones'));
          img.src = dimsUrl;
        });
        imageWidth = dims.w;
        imageHeight = dims.h;
      } finally {
        URL.revokeObjectURL(dimsUrl);
      }

      setImportPhase('import', 20);
      const textCount = await applyVisionMenuImportToCanvas(canvas, {
        imageUrl,
        assetId,
        imageWidth,
        imageHeight,
        menu,
      });

      setImportPhase('import', 100);
      setActiveObject(null);
      refreshObjects();
      handleChange();

      setEditorError('');
      setImportOpen(false);
      const providerHint = menu.provider ? ` (${menu.provider})` : '';
      alert(
        `Importación completada${providerHint}: ${textCount} capas de texto por secciones. Revisa y ajusta antes de guardar.`,
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

  async function handleUseAssetOnPage(asset: AssetSummary) {
    const canvas = getActiveCanvas();
    if (!canvas) {
      throw new Error('No hay página activa en el editor');
    }
    if (!asset.url) {
      throw new Error('El archivo no tiene una URL válida');
    }

    setEditorError('');

    const natural = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () =>
        resolve({
          width: img.naturalWidth || 220,
          height: img.naturalHeight || 220,
        });
      img.onerror = () => reject(new Error('No se pudo cargar la imagen del archivo'));
      img.crossOrigin = 'anonymous';
      img.src = asset.url!;
    });

    const maxW = 280;
    const ratio = natural.height / Math.max(natural.width, 1);
    const layer = {
      id: `layer_${crypto.randomUUID().slice(0, 8)}`,
      type: 'image' as const,
      name: 'Imagen',
      src: asset.url,
      assetId: asset.id,
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
      layerName: layer.name,
    };
    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.requestRenderAll();
    setActiveObject(img);
    setAssetsOpen(false);
    handleChange();
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
    setBackgroundPickActive(false);
    handleChange();
  }

  async function handlePickBackgroundColor() {
    setEditorError('');
    if (supportsNativeEyeDropper()) {
      const hex = await pickColorWithEyeDropper();
      if (hex) handleChangeBackground(hex);
      return;
    }
    setBackgroundPickActive((prev) => !prev);
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
    const pagesForPdf = pages
      .map((page, index) => {
        const dataUrl = pageRefs.current[index]?.exportPng();
        if (!dataUrl) return null;
        const size = getPageSize(page);
        return { dataUrl, width: size.width, height: size.height };
      })
      .filter((p): p is { dataUrl: string; width: number; height: number } => !!p);
    if (pagesForPdf.length === 0) return;
    exportPagesToPdf(pagesForPdf, title || 'carta-menu');
  }

  function handlePageSizeChange(size: { width: number; height: number }) {
    const index = activePageIndex;
    setPages((prev) =>
      prev.map((page, i) =>
        i === index ? { ...page, width: size.width, height: size.height } : page,
      ),
    );
    // Redimensionar tras el commit de React por si el ref se actualiza en el mismo ciclo.
    window.requestAnimationFrame(() => {
      pageRefs.current[index]?.resizePage(size.width, size.height);
    });
    scheduleSave();
  }

  function handleExportJson() {
    const data = collectDocument();
    exportMenuDocumentJson(data, title || 'menu', title || undefined);
  }

  async function handleImportJson(file: File) {
    setEditorError('');
    try {
      const imported = await parseMenuJsonFile(file);
      const confirmed = confirm(
        `¿Reemplazar el menú actual por «${file.name}»?\n\nSe sustituirán todas las páginas del editor.`,
      );
      if (!confirmed) return;

      historyByPageIdRef.current.clear();
      transferHistoryLinkRef.current = null;
      transferRedoLinkRef.current = null;
      bumpHistoryUi();
      pageRefs.current = [];
      setPages(imported.pages);
      setPageScroll(imported.pageScroll ?? 'vertical');
      setActivePageIndex(0);
      setActiveObject(null);
      const firstBg = imported.pages[0]?.background;
      setBackgroundColor(firstBg?.type === 'color' ? firstBg.value : '#FAF6F0');

      window.setTimeout(() => {
        void (async () => {
          for (let i = 0; i < imported.pages.length; i++) {
            await pageRefs.current[i]?.loadPage(imported.pages[i]);
          }
          refreshObjects();
          scheduleSave();
        })();
      }, 80);
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : 'No se pudo importar el JSON');
    }
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

  function handleSendToBack(obj: FabricObject) {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    canvas.sendObjectToBack(obj);
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
    const newId = `layer_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
    setLayerObjectData(cloned, { layerId: newId });
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

    if (src && src.includes('/api/assets/file')) {
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

  if (loading) {
    return (
      <div className="loading-screen">
        <p>Cargando editor...</p>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="loading-screen">
        <p>No hay páginas en este menú.</p>
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
          interactionMode={interactionMode}
          onInteractionModeChange={setInteractionMode}
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
        onMergeTexts={handleMergeTexts}
        canMergeTexts={canMergeSelectedTextLayers(getActiveCanvas())}
        onChangeBackground={handleChangeBackground}
        onPickBackgroundColor={() => {
          void handlePickBackgroundColor();
        }}
        backgroundPickActive={backgroundPickActive}
        onExportPng={handleExportPng}
        onExportPdf={handleExportPdf}
        onExportJson={handleExportJson}
        onImportJson={(file) => {
          void handleImportJson(file);
        }}
        onOpenQr={() => setQrOpen(true)}
        onAddPage={handleAddPage}
        onDeletePage={() => handleDeletePage()}
        onMovePageUp={() => handleMovePageUp()}
        onMovePageDown={() => handleMovePageDown()}
        canDeletePage={pages.length > 1}
        canMovePageUp={activePageIndex > 0}
        canMovePageDown={activePageIndex < pages.length - 1}
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
              setInteractionMode('move');
              handleSelectObject(obj);
              setMobilePanel('canvas');
            }}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onSendToBack={handleSendToBack}
            onToggleVisibility={handleToggleVisibility}
            onToggleLock={handleToggleLock}
            onRenameLayer={handleRenameLayer}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />
        </aside>

        <main
          className={`editor-canvas-area editor-canvas-area--${interactionMode}${
            backgroundPickActive ? ' editor-canvas-area--eyedropper' : ''
          }`}
          ref={canvasAreaRef}
          onPointerDown={(e) => {
            if (interactionMode === 'scroll') return;
            const target = e.target as HTMLElement | null;
            // Clic dentro del lienzo (o su contenedor Fabric): no deseleccionar.
            if (target?.closest('.page-canvas')) return;

            const canvas = getActiveCanvas();
            if (!canvas?.getActiveObject()) return;
            canvas.discardActiveObject();
            canvas.requestRenderAll();
            setActiveObject(null);
          }}
        >
          <div className="pages-stack">
            {pages.map((page, index) => (
              <div
                key={page.id}
                className="page-block"
                onPointerDown={() => {
                  if (interactionMode === 'scroll') return;
                  handleActivatePage(index);
                }}
              >
                <div className="page-label-row">
                  <button
                    type="button"
                    className="page-label"
                    onClick={() => handleActivatePage(index)}
                  >
                    Página {index + 1}
                    {index === activePageIndex && (
                      <span className="page-label-active"> · editando</span>
                    )}
                    <span className="page-label-size">
                      {' '}
                      · {ptToCm(getPageSize(page).width)}×{ptToCm(getPageSize(page).height)} cm
                    </span>
                  </button>
                  {pages.length > 1 && (
                    <div className="page-order-actions" role="group" aria-label="Orden de página">
                      <button
                        type="button"
                        title="Subir página"
                        aria-label={`Subir página ${index + 1}`}
                        disabled={index === 0}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMovePageUp(index);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        title="Bajar página"
                        aria-label={`Bajar página ${index + 1}`}
                        disabled={index === pages.length - 1}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMovePageDown(index);
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="page-order-actions__delete"
                        title="Eliminar página"
                        aria-label={`Eliminar página ${index + 1}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePage(index);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
                <CanvasEditor
                  ref={(handle) => {
                    pageRefs.current[index] = handle;
                  }}
                  pageId={page.id}
                  initialPage={page}
                  zoom={zoom}
                  active={index === activePageIndex}
                  interactionMode={interactionMode}
                  pageIndex={index}
                  canSpillPrev={index > 0}
                  canSpillNext={index < pages.length - 1}
                  onSpillOffPage={(payload) => {
                    if (payload.type === 'index') {
                      void handleTransferSelectionToPage(payload.index, true);
                    } else {
                      void handleTransferSelectionToAdjacentPage(
                        payload.direction,
                        true,
                      );
                    }
                  }}
                  onSelectionChange={(obj) => {
                    if (index !== activePageIndexRef.current) return;
                    setActiveObject(obj);
                  }}
                  onChange={handleChange}
                  onReady={() => {
                    seedHistoryForPage(index);
                    if (index === activePageIndexRef.current) {
                      refreshObjects();
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </main>

        <aside className="editor-sidebar right">
          <PublicScrollControls
            value={pageScroll}
            onChange={(next) => {
              setPageScroll(next);
              scheduleSave();
            }}
          />
          {pages[activePageIndex] && (
            <PageSizeControls
              page={pages[activePageIndex]}
              pageIndex={activePageIndex}
              onChange={handlePageSizeChange}
            />
          )}
          <PropertiesPanel
            activeObject={activeObject}
            selectedTextCount={getSelectedTextObjects(getActiveCanvas()).length}
            pageIndex={activePageIndex}
            pageCount={pages.length}
            canPasteLayer={clipboardLayerCount > 0}
            onCopyLayer={() => {
              handleCopyLayers();
            }}
            onPasteLayer={() => {
              void handlePasteLayers();
            }}
            onMoveToPrevPage={
              activePageIndex > 0
                ? () => {
                    void handleTransferSelectionToAdjacentPage('prev', false);
                  }
                : undefined
            }
            onMoveToNextPage={
              activePageIndex < pages.length - 1
                ? () => {
                    void handleTransferSelectionToAdjacentPage('next', false);
                  }
                : undefined
            }
            onUpdate={handleChange}
            onMergeTexts={handleMergeTexts}
            onSendToBack={
              activeObject ? () => handleSendToBack(activeObject) : undefined
            }
          />
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
        onUseOnPage={handleUseAssetOnPage}
        onAssetDeleted={(asset) => {
          void handleAssetDeletedFromManager(asset);
        }}
      />

      <ImportMenuModal
        open={importOpen}
        onClose={() => !uploadProgress && setImportOpen(false)}
        onImport={handleImportFromImage}
        busy={!!uploadProgress && importOpen}
        progress={importOpen ? uploadProgress : null}
        pageIndex={activePageIndex}
      />

      {uploadProgress && !importOpen && (
        <div
          className="stock-modal-overlay stock-modal-overlay--blocking"
          role="alertdialog"
          aria-modal="true"
          aria-busy="true"
          aria-labelledby="editor-busy-title"
        >
          <div className="stock-modal editor-busy-modal" onClick={(e) => e.stopPropagation()}>
            <header className="stock-modal-header">
              <h2 id="editor-busy-title">Procesando…</h2>
            </header>
            <div className="import-menu-busy">
              <p className="import-menu-busy-phase">
                {uploadProgress.phase === 'compress'
                  ? 'Comprimiendo imagen'
                  : uploadProgress.phase === 'upload'
                    ? 'Subiendo archivo'
                    : uploadProgress.phase === 'ocr'
                      ? 'Leyendo carta con IA'
                      : uploadProgress.phase === 'import'
                        ? 'Creando capas en el lienzo'
                        : uploadProgress.phase === 'place'
                          ? 'Colocando en el lienzo'
                          : 'Procesando'}
              </p>
              <div className="upload-progress-track import-menu-busy-track">
                <div
                  className="upload-progress-bar"
                  style={{ width: `${Math.max(0, Math.min(100, uploadProgress.percent))}%` }}
                />
              </div>
              <p className="import-menu-busy-percent">{uploadProgress.percent}%</p>
              <p className="import-menu-busy-hint">
                Espera a que termine. No edites el menú hasta entonces.
              </p>
            </div>
          </div>
        </div>
      )}

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
