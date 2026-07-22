import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Canvas } from 'fabric';
import type { MenuPage } from '@/types/canvas';
import { A4_HEIGHT, A4_WIDTH } from '@/types/canvas';
import {
  applyCanvasZoom,
  isTextObject,
  loadPageOntoCanvas,
  canvasToPageData,
  refreshTextboxLayout,
} from '@/lib/canvas-serializer';
import type { CanvasInteractionMode } from '@/components/editor/EditorZoomControls';

export interface CanvasEditorHandle {
  getCanvas: () => Canvas | null;
  getPageData: () => MenuPage | null;
  exportPng: () => string | null;
  loadPage: (page: MenuPage) => Promise<void>;
  discardSelectionSilent: () => void;
}

interface CanvasEditorProps {
  pageId: string;
  initialPage: MenuPage;
  zoom?: number;
  active?: boolean;
  interactionMode?: CanvasInteractionMode;
  onSelectionChange?: (object: import('fabric').FabricObject | null) => void;
  onChange?: () => void;
  onReady?: () => void;
}

export const CanvasEditor = forwardRef<CanvasEditorHandle, CanvasEditorProps>(
  function CanvasEditor(
    {
      pageId,
      initialPage,
      zoom = 100,
      active = false,
      interactionMode = 'move',
      onSelectionChange,
      onChange,
      onReady,
    },
    ref,
  ) {
    const canvasRef = useRef<Canvas | null>(null);
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const pageIdRef = useRef(pageId);
    pageIdRef.current = pageId;
    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;
    const muteEventsRef = useRef(true);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const onSelectionChangeRef = useRef(onSelectionChange);
    onSelectionChangeRef.current = onSelectionChange;
    const interactionModeRef = useRef(interactionMode);
    interactionModeRef.current = interactionMode;
    const activeRef = useRef(active);
    activeRef.current = active;

    function emitChange() {
      if (muteEventsRef.current) return;
      // Solo la página activa propaga cambios (evita tormentas entre lienzos).
      if (!activeRef.current) return;
      onChangeRef.current?.();
    }

    useImperativeHandle(
      ref,
      () => ({
        getCanvas: () => canvasRef.current,
        getPageData: () => {
          if (!canvasRef.current) return null;
          return canvasToPageData(canvasRef.current, pageIdRef.current);
        },
        exportPng: () => {
          const canvas = canvasRef.current;
          if (!canvas) return null;
          const z = canvas.getZoom() || 1;
          return canvas.toDataURL({ format: 'png', multiplier: 2 / z });
        },
        loadPage: async (page: MenuPage) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          muteEventsRef.current = true;
          try {
            await loadPageOntoCanvas(canvas, page, A4_WIDTH, A4_HEIGHT);
            if (canvasRef.current === canvas) {
              applyCanvasZoom(canvas, zoomRef.current);
            }
          } finally {
            muteEventsRef.current = false;
          }
        },
        discardSelectionSilent: () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const wasMuted = muteEventsRef.current;
          muteEventsRef.current = true;
          try {
            canvas.discardActiveObject();
            canvas.requestRenderAll();
          } finally {
            muteEventsRef.current = wasMuted;
          }
        },
      }),
      [],
    );

    useEffect(() => {
      if (!canvasElRef.current) return;

      let cancelled = false;
      muteEventsRef.current = true;

      const canvas = new Canvas(canvasElRef.current, {
        width: A4_WIDTH,
        height: A4_HEIGHT,
        preserveObjectStacking: true,
        enableRetinaScaling: true,
        backgroundColor:
          initialPage.background.type === 'color' ? initialPage.background.value : '#fff',
        // Por defecto no interactivo hasta que la página sea activa + modo move.
        selection: false,
        skipTargetFind: true,
      });

      canvasRef.current = canvas;

      loadPageOntoCanvas(canvas, initialPage, A4_WIDTH, A4_HEIGHT)
        .then(() => {
          if (cancelled || canvasRef.current !== canvas) return;
          applyCanvasZoom(canvas, zoomRef.current);
          // Aplicar modo real tras la carga.
          const interactive =
            activeRef.current && interactionModeRef.current === 'move';
          canvas.selection = interactive;
          canvas.skipTargetFind = !interactive;
          muteEventsRef.current = false;
          onReadyRef.current?.();
        })
        .catch((err) => {
          if (!cancelled) {
            muteEventsRef.current = false;
            console.error(err);
          }
        });

      canvas.on('selection:created', () => {
        if (muteEventsRef.current) return;
        if (!activeRef.current) return;
        if (interactionModeRef.current === 'scroll') return;
        onSelectionChangeRef.current?.(canvas.getActiveObject() ?? null);
      });
      canvas.on('selection:updated', () => {
        if (muteEventsRef.current) return;
        if (!activeRef.current) return;
        if (interactionModeRef.current === 'scroll') return;
        onSelectionChangeRef.current?.(canvas.getActiveObject() ?? null);
      });
      canvas.on('selection:cleared', () => {
        if (muteEventsRef.current) return;
        if (!activeRef.current) return;
        if (interactionModeRef.current === 'scroll') return;
        onSelectionChangeRef.current?.(null);
      });
      canvas.on('object:modified', () => emitChange());

      canvas.on('text:changed', (e) => {
        const target = e.target;
        if (!target || !isTextObject(target)) return;
        const text = target as import('fabric').Textbox;
        if ((text.width ?? 0) < 48) {
          refreshTextboxLayout(target);
        } else {
          text.initDimensions();
          text.setCoords();
          canvas.requestRenderAll();
        }
        emitChange();
      });

      canvas.on('text:editing:exited', (e) => {
        const target = e.target;
        if (!target || !isTextObject(target)) return;
        refreshTextboxLayout(target);
        emitChange();
      });

      return () => {
        cancelled = true;
        muteEventsRef.current = true;
        canvas.dispose();
        if (canvasRef.current === canvas) {
          canvasRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageId]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || muteEventsRef.current) return;
      applyCanvasZoom(canvas, zoom);
    }, [zoom]);

    // Interactivo solo si esta página está activa y el modo es Mover.
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const interactive = active && interactionMode === 'move';
      canvas.selection = interactive;
      canvas.skipTargetFind = !interactive;

      if (!active) {
        const wasMuted = muteEventsRef.current;
        muteEventsRef.current = true;
        try {
          canvas.discardActiveObject();
          canvas.requestRenderAll();
        } finally {
          muteEventsRef.current = wasMuted;
        }
      }
    }, [active, interactionMode]);

    return (
      <div
        className={`editor-canvas-wrap page-canvas ${active ? 'page-canvas--active' : ''}${
          interactionMode === 'scroll' ? ' page-canvas--scroll' : ' page-canvas--move'
        }`}
      >
        <canvas ref={canvasElRef} />
      </div>
    );
  },
);
