import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Canvas } from 'fabric';
import type { FabricObject } from 'fabric';
import type { MenuPage } from '@/types/canvas';
import { getPageSize } from '@/lib/page-size';
import {
  applyCanvasZoom,
  isTextObject,
  canvasToPageData,
  refreshTextboxLayout,
  resizeCanvasPage,
} from '@/lib/canvas-serializer';
import { getLayerObjectData, setLayerObjectData } from '@/lib/layer-utils';
import {
  finalizeMenuLineTransform,
  isMenuLineGroup,
  findMenuLineCellAtPoint,
  beginMenuLineColumnEditing,
  layoutMenuLineGroup,
} from '@/lib/menu-line';
import { hydrateDesign } from '@/lib/canvas/render-design';
import type { CanvasInteractionMode } from '@/components/editor/EditorZoomControls';
import {
  clampActiveObjectsIntoPage,
  detectPageSpill,
  isPageTransferInFlight,
  resolveDropPageIndex,
} from '@/lib/transfer-page-objects';

export interface CanvasEditorHandle {
  getCanvas: () => Canvas | null;
  getPageData: () => MenuPage | null;
  exportPng: () => string | null;
  loadPage: (page: MenuPage) => Promise<void>;
  discardSelectionSilent: () => void;
  resizePage: (width: number, height: number) => void;
}

export type SpillOffPagePayload =
  | { type: 'index'; index: number }
  | { type: 'direction'; direction: 'prev' | 'next' };

interface CanvasEditorProps {
  pageId: string;
  initialPage: MenuPage;
  zoom?: number;
  active?: boolean;
  interactionMode?: CanvasInteractionMode;
  pageIndex?: number;
  canSpillPrev?: boolean;
  canSpillNext?: boolean;
  onSpillOffPage?: (payload: SpillOffPagePayload) => void;
  onSelectionChange?: (object: FabricObject | null) => void;
  onChange?: () => void;
  onReady?: () => void;
}

function readClientPoint(evt: Event | undefined | null): { x: number; y: number } | null {
  if (!evt) return null;
  if ('clientX' in evt && typeof (evt as MouseEvent).clientX === 'number') {
    const e = evt as MouseEvent;
    if (Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) {
      return { x: e.clientX, y: e.clientY };
    }
  }
  if ('changedTouches' in evt) {
    const t = (evt as TouchEvent).changedTouches?.[0];
    if (t && Number.isFinite(t.clientX) && Number.isFinite(t.clientY)) {
      return { x: t.clientX, y: t.clientY };
    }
  }
  return null;
}

export const CanvasEditor = forwardRef<CanvasEditorHandle, CanvasEditorProps>(
  function CanvasEditor(
    {
      pageId,
      initialPage,
      zoom = 100,
      active = false,
      interactionMode = 'move',
      pageIndex = 0,
      canSpillPrev = false,
      canSpillNext = false,
      onSpillOffPage,
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
    const onSpillOffPageRef = useRef(onSpillOffPage);
    onSpillOffPageRef.current = onSpillOffPage;
    const pageIndexRef = useRef(pageIndex);
    pageIndexRef.current = pageIndex;
    const canSpillPrevRef = useRef(canSpillPrev);
    canSpillPrevRef.current = canSpillPrev;
    const canSpillNextRef = useRef(canSpillNext);
    canSpillNextRef.current = canSpillNext;
    const interactionModeRef = useRef(interactionMode);
    interactionModeRef.current = interactionMode;
    const activeRef = useRef(active);
    activeRef.current = active;

    const initialSize = getPageSize(initialPage);

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
          const size = getPageSize(page);
          muteEventsRef.current = true;
          try {
            await hydrateDesign(canvas, page);
            if (canvasRef.current === canvas) {
              applyCanvasZoom(canvas, zoomRef.current, size.width, size.height);
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
        resizePage: (width: number, height: number) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          resizeCanvasPage(canvas, width, height, zoomRef.current);
        },
      }),
      [],
    );

    useEffect(() => {
      if (!canvasElRef.current) return;

      let cancelled = false;
      muteEventsRef.current = true;
      const size = getPageSize(initialPage);

      /** Solo un intento de spill/clamp por gesto de arrastre. */
      let dragMoved = false;
      let dragHandled = false;
      const lastPointer = { x: 0, y: 0 };

      const canvas = new Canvas(canvasElRef.current, {
        width: size.width,
        height: size.height,
        preserveObjectStacking: true,
        enableRetinaScaling: true,
        backgroundColor:
          initialPage.background.type === 'color' ? initialPage.background.value : '#fff',
        // Por defecto no interactivo hasta que la página sea activa + modo move.
        selection: false,
        skipTargetFind: true,
      });

      canvasRef.current = canvas;

      hydrateDesign(canvas, initialPage)
        .then(() => {
          if (cancelled || canvasRef.current !== canvas) return;
          applyCanvasZoom(canvas, zoomRef.current, size.width, size.height);
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

      const rememberPointer = (evt: Event | undefined | null) => {
        const pt = readClientPoint(evt);
        if (pt) {
          lastPointer.x = pt.x;
          lastPointer.y = pt.y;
        }
      };

      /**
       * Al soltar tras arrastrar: transferir a otra página o recuperar dentro del lienzo.
       * Devuelve true si se disparó transferencia (el padre hará onChange).
       */
      const finishDragIfNeeded = (target: FabricObject | null | undefined): boolean => {
        if (!dragMoved || dragHandled) return false;
        dragHandled = true;
        dragMoved = false;

        if (muteEventsRef.current || !activeRef.current) return false;
        if (interactionModeRef.current === 'scroll') return false;
        if (isPageTransferInFlight()) {
          clampActiveObjectsIntoPage(canvas);
          return false;
        }

        const spillHandler = onSpillOffPageRef.current;
        if (spillHandler) {
          const dropIndex = resolveDropPageIndex(
            lastPointer.x,
            lastPointer.y,
            pageIndexRef.current,
          );
          if (dropIndex != null) {
            spillHandler({ type: 'index', index: dropIndex });
            return true;
          }

          const spill = detectPageSpill(canvas, target ?? canvas.getActiveObject());
          const canSpill =
            (spill === 'next' && canSpillNextRef.current) ||
            (spill === 'prev' && canSpillPrevRef.current);
          if (spill && canSpill) {
            spillHandler({ type: 'direction', direction: spill });
            return true;
          }
        }

        clampActiveObjectsIntoPage(canvas);
        return false;
      };

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

      canvas.on('object:moving', (e) => {
        if (muteEventsRef.current || !activeRef.current) return;
        if (interactionModeRef.current === 'scroll') return;
        dragMoved = true;
        dragHandled = false;
        rememberPointer((e as { e?: Event }).e);
      });

      canvas.on('mouse:move', (opt) => {
        rememberPointer(opt.e as Event | undefined);
      });

      canvas.on('mouse:up', (opt) => {
        rememberPointer(opt.e as Event | undefined);
        // Preferimos resolver aquí: el puntero es fiable al soltar.
        if (!dragMoved || dragHandled) return;
        const spilled = finishDragIfNeeded(canvas.getActiveObject());
        if (!spilled) emitChange();
      });

      canvas.on('object:modified', (e) => {
        if (muteEventsRef.current || !activeRef.current) return;
        if (interactionModeRef.current === 'scroll') return;

        const target = e.target ?? null;
        if (target && isMenuLineGroup(target)) {
          finalizeMenuLineTransform(target);
        }

        const action =
          (e as { action?: string }).action ??
          (e as { transform?: { action?: string } }).transform?.action;
        rememberPointer((e as { e?: Event }).e);

        // Si mouse:up ya resolvió el arrastre, no repetir.
        if (dragHandled) return;

        // Respaldo si modified llega sin mouse:up previo.
        if ((!action || action === 'drag') && dragMoved) {
          const spilled = finishDragIfNeeded(e.target ?? null);
          if (!spilled) emitChange();
          return;
        }

        emitChange();
      });

      canvas.on('mouse:dblclick', (opt) => {
        if (muteEventsRef.current || !activeRef.current) return;
        const target = opt.target;
        if (!target || !isMenuLineGroup(target)) return;
        const pointer = canvas.getScenePoint(opt.e);
        const cell = findMenuLineCellAtPoint(target, pointer.x, pointer.y);
        if (!cell) return;
        beginMenuLineColumnEditing(canvas, target, cell.key, cell.rowIndex);
      });

      canvas.on('text:changed', (e) => {
        const target = e.target;
        if (!target || !isTextObject(target)) return;
        const role = getLayerObjectData(target).menuLineRole;
        const parent = (target as { group?: import('fabric').Group }).group;
        if (role && parent && isMenuLineGroup(parent)) {
          if (role === 'center') {
            setLayerObjectData(target, { menuLineLeader: 'custom' });
          }
          layoutMenuLineGroup(parent);
          emitChange();
          return;
        }
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
        const role = getLayerObjectData(target).menuLineRole;
        const parent = (target as { group?: import('fabric').Group }).group;
        if (role && parent && isMenuLineGroup(parent)) {
          if (role === 'center') {
            setLayerObjectData(target, { menuLineLeader: 'custom' });
          }
          layoutMenuLineGroup(parent);
          emitChange();
          return;
        }
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
      applyCanvasZoom(canvas, zoom, initialSize.width, initialSize.height);
    }, [zoom, initialSize.width, initialSize.height]);

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
        style={{
          width: initialSize.width * (zoom / 100),
          height: initialSize.height * (zoom / 100),
        }}
      >
        <canvas ref={canvasElRef} />
      </div>
    );
  },
);
