import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Canvas } from 'fabric';
import type { MenuPage } from '@/types/canvas';
import { A4_HEIGHT, A4_WIDTH } from '@/types/canvas';
import { loadPageOntoCanvas, canvasToPageData } from '@/lib/canvas-serializer';

export interface CanvasEditorHandle {
  getCanvas: () => Canvas | null;
  getPageData: () => MenuPage | null;
  exportPng: () => string | null;
  loadPage: (page: MenuPage) => Promise<void>;
}

interface CanvasEditorProps {
  pageId: string;
  initialPage: MenuPage;
  active?: boolean;
  onActivate?: () => void;
  onSelectionChange?: (object: import('fabric').FabricObject | null) => void;
  onChange?: () => void;
}

export const CanvasEditor = forwardRef<CanvasEditorHandle, CanvasEditorProps>(
  function CanvasEditor(
    { pageId, initialPage, active = false, onActivate, onSelectionChange, onChange },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<Canvas | null>(null);
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const pageIdRef = useRef(pageId);
    pageIdRef.current = pageId;

    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
      getPageData: () => {
        if (!canvasRef.current) return null;
        return canvasToPageData(canvasRef.current, pageIdRef.current);
      },
      exportPng: () => {
        if (!canvasRef.current) return null;
        return canvasRef.current.toDataURL({ format: 'png', multiplier: 2 });
      },
      loadPage: async (page: MenuPage) => {
        if (!canvasRef.current) return;
        await loadPageOntoCanvas(canvasRef.current, page, A4_WIDTH, A4_HEIGHT);
      },
    }));

    useEffect(() => {
      if (!canvasElRef.current) return;

      const canvas = new Canvas(canvasElRef.current, {
        width: A4_WIDTH,
        height: A4_HEIGHT,
        preserveObjectStacking: true,
        backgroundColor:
          initialPage.background.type === 'color' ? initialPage.background.value : '#fff',
      });

      canvasRef.current = canvas;

      loadPageOntoCanvas(canvas, initialPage, A4_WIDTH, A4_HEIGHT)
        .then(() => onChange?.())
        .catch(console.error);

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
      canvas.on('object:modified', () => onChange?.());
      canvas.on('object:added', () => onChange?.());
      canvas.on('object:removed', () => onChange?.());
      canvas.on('mouse:down', () => onActivate?.());

      return () => {
        canvas.dispose();
        canvasRef.current = null;
      };
      // Solo montar una vez por pageId
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageId]);

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
