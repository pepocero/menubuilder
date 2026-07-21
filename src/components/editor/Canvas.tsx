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

export interface CanvasEditorHandle {
  getCanvas: () => Canvas | null;
  getPageData: () => MenuPage | null;
  exportPng: () => string | null;
  loadPage: (page: MenuPage) => Promise<void>;
}

interface CanvasEditorProps {
  pageId: string;
  initialPage: MenuPage;
  zoom?: number;
  active?: boolean;
  onActivate?: () => void;
  onSelectionChange?: (object: import('fabric').FabricObject | null) => void;
  onChange?: () => void;
  /** Tras la carga inicial del lienzo (para sembrar historial sin disparar onChange). */
  onReady?: () => void;
}

export const CanvasEditor = forwardRef<CanvasEditorHandle, CanvasEditorProps>(
  function CanvasEditor(
    {
      pageId,
      initialPage,
      zoom = 100,
      active = false,
      onActivate,
      onSelectionChange,
      onChange,
      onReady,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<Canvas | null>(null);
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const pageIdRef = useRef(pageId);
    pageIdRef.current = pageId;
    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;
    const loadingRef = useRef(false);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;

    function emitChange() {
      if (loadingRef.current) return;
      onChangeRef.current?.();
    }

    useImperativeHandle(ref, () => ({
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
        loadingRef.current = true;
        try {
          await loadPageOntoCanvas(canvas, page, A4_WIDTH, A4_HEIGHT);
          if (canvasRef.current === canvas) {
            applyCanvasZoom(canvas, zoomRef.current);
          }
        } finally {
          loadingRef.current = false;
        }
      },
    }));

    useEffect(() => {
      if (!canvasElRef.current) return;

      let cancelled = false;
      loadingRef.current = true;

      const canvas = new Canvas(canvasElRef.current, {
        width: A4_WIDTH,
        height: A4_HEIGHT,
        preserveObjectStacking: true,
        enableRetinaScaling: true,
        backgroundColor:
          initialPage.background.type === 'color' ? initialPage.background.value : '#fff',
      });

      canvasRef.current = canvas;

      loadPageOntoCanvas(canvas, initialPage, A4_WIDTH, A4_HEIGHT)
        .then(() => {
          if (cancelled || canvasRef.current !== canvas) return;
          applyCanvasZoom(canvas, zoomRef.current);
          loadingRef.current = false;
          onReadyRef.current?.();
        })
        .catch((err) => {
          loadingRef.current = false;
          if (!cancelled) console.error(err);
        });

      canvas.on('selection:created', (e) => {
        onActivate?.();
        onSelectionChange?.(e.selected?.[0] ?? null);
      });
      canvas.on('selection:updated', (e) => {
        onActivate?.();
        onSelectionChange?.(e.selected?.[0] ?? null);
      });
      canvas.on('selection:cleared', () => {
        onSelectionChange?.(null);
      });
      canvas.on('object:modified', () => emitChange());
      canvas.on('object:added', () => emitChange());
      canvas.on('object:removed', () => emitChange());
      canvas.on('mouse:down', () => onActivate?.());

      canvas.on('text:changed', (e) => {
        const target = e.target;
        if (!target || !isTextObject(target)) return;
        const text = target as import('fabric').Textbox;
        if (text.styles && Object.keys(text.styles).length > 0) {
          text.styles = {};
          text.set('styles', {});
        }
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
        loadingRef.current = false;
        canvas.dispose();
        if (canvasRef.current === canvas) {
          canvasRef.current = null;
        }
      };
      // Solo montar una vez por pageId
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageId]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || loadingRef.current) return;
      applyCanvasZoom(canvas, zoom);
    }, [zoom]);

    return (
      <div
        className={`editor-canvas-wrap page-canvas ${active ? 'page-canvas--active' : ''}`}
        ref={containerRef}
        onMouseDown={() => onActivate?.()}
      >
        <canvas ref={canvasElRef} />
      </div>
    );
  },
);
