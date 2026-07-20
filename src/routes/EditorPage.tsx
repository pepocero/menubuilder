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
import { exportPagesToPdf } from '@/lib/export';
import { CanvasEditor, type CanvasEditorHandle } from '@/components/editor/Canvas';
import { LayersPanel } from '@/components/editor/LayersPanel';
import { PropertiesPanel } from '@/components/editor/PropertiesPanel';
import { PublishQrModal } from '@/components/editor/PublishQrModal';
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
  const [stockBusy, setStockBusy] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [publicSlug, setPublicSlug] = useState<string | null>(null);
  const [editorError, setEditorError] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#FAF6F0');
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);
  const uploadInFlightRef = useRef(false);
  const [mobilePanel, setMobilePanel] = useState<'canvas' | 'layers' | 'props'>('canvas');

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef(title);
  titleRef.current = title;
  const pagesMetaRef = useRef(pages);
  pagesMetaRef.current = pages;

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

  const refreshObjects = useCallback(() => {
    const canvas = getActiveCanvas();
    if (canvas) {
      setObjects([...canvas.getObjects()]);
      const bg = canvas.backgroundColor;
      if (typeof bg === 'string') setBackgroundColor(bg);
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
      } catch {
        setSaveStatus('unsaved');
      }
    }, 2500);
  }, [menuId, collectDocument]);

  useEffect(() => {
    if (!menuId) return;
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
  }, [menuId, navigate]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => refreshObjects(), 200);
    return () => clearTimeout(timer);
  }, [activePageIndex, pages.length, refreshObjects]);

  const handleChange = useCallback(() => {
    refreshObjects();
    scheduleSave();
  }, [refreshObjects, scheduleSave]);

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

    const next = pages.filter((_, i) => i !== activePageIndex);
    pageRefs.current = pageRefs.current.filter((_, i) => i !== activePageIndex);
    setPages(next);
    setActivePageIndex(Math.min(activePageIndex, next.length - 1));
    setActiveObject(null);
    scheduleSave();
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

  function handleFitImageToA4() {
    const canvas = getActiveCanvas();
    if (!canvas || !activeObject || !isImageObject(activeObject)) return;
    ensureA4Canvas(canvas);
    fitImageToA4(activeObject as FabricImage, canvas, 'cover');
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
    const locked = obj.selectable !== false;
    obj.set({ selectable: !locked, evented: !locked });
    obj.canvas?.requestRenderAll();
    refreshObjects();
    scheduleSave();
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
        onAddText={handleAddText}
        onAddRect={() => handleAddShape('rect')}
        onAddLine={() => handleAddShape('line')}
        onAddCircle={() => handleAddShape('circle')}
        onUploadImage={handleUploadImage}
        onOpenStock={() => setStockOpen(true)}
        onFitImageToA4={handleFitImageToA4}
        canFitImage={!!activeObject && isImageObject(activeObject)}
        onChangeBackground={handleChangeBackground}
        onExportPng={handleExportPng}
        onExportPdf={handleExportPdf}
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
            activeObject={activeObject}
            onSelect={(obj) => {
              handleSelectObject(obj);
              setMobilePanel('canvas');
            }}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onToggleVisibility={handleToggleVisibility}
            onToggleLock={handleToggleLock}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />
        </aside>

        <main className="editor-canvas-area">
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
                  active={index === activePageIndex}
                  onActivate={() => handleActivatePage(index)}
                  onSelectionChange={(obj) => {
                    handleActivatePage(index);
                    setActiveObject(obj);
                    if (obj) setMobilePanel('props');
                  }}
                  onChange={handleChange}
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
