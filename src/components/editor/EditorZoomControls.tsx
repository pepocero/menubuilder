export type CanvasInteractionMode = 'scroll' | 'move';

interface EditorZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomFit: () => void;
  interactionMode: CanvasInteractionMode;
  onInteractionModeChange: (mode: CanvasInteractionMode) => void;
}

export function EditorZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomFit,
  interactionMode,
  onInteractionModeChange,
}: EditorZoomControlsProps) {
  return (
    <div className="editor-zoom-bar">
      <div className="editor-interaction-mode" role="group" aria-label="Modo del lienzo">
        <button
          type="button"
          className={interactionMode === 'move' ? 'is-active' : undefined}
          title="Mover y editar capas en el lienzo"
          aria-pressed={interactionMode === 'move'}
          onClick={() => onInteractionModeChange('move')}
        >
          Mover
        </button>
        <button
          type="button"
          className={interactionMode === 'scroll' ? 'is-active' : undefined}
          title="Desplazar el lienzo (scroll). Ideal en móvil para ver toda la página."
          aria-pressed={interactionMode === 'scroll'}
          onClick={() => onInteractionModeChange('scroll')}
        >
          Scroll
        </button>
      </div>

      <div className="editor-zoom-controls" aria-label="Zoom del lienzo">
        <button type="button" onClick={onZoomOut} title="Alejar (Ctrl+rueda)">
          −
        </button>
        <button
          type="button"
          className="editor-zoom-value"
          onClick={onZoomReset}
          title="Restablecer 100%"
        >
          {zoom}%
        </button>
        <button type="button" onClick={onZoomIn} title="Acercar (Ctrl+rueda)">
          +
        </button>
        <button type="button" onClick={onZoomFit} title="Ajustar a la ventana">
          Ajustar
        </button>
      </div>
    </div>
  );
}
