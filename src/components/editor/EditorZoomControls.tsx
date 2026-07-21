interface EditorZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomFit: () => void;
}

export function EditorZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomFit,
}: EditorZoomControlsProps) {
  return (
    <div className="editor-zoom-controls" aria-label="Zoom del lienzo">
      <button type="button" onClick={onZoomOut} title="Alejar (Ctrl+rueda)">
        −
      </button>
      <button type="button" className="editor-zoom-value" onClick={onZoomReset} title="Restablecer 100%">
        {zoom}%
      </button>
      <button type="button" onClick={onZoomIn} title="Acercar (Ctrl+rueda)">
        +
      </button>
      <button type="button" onClick={onZoomFit} title="Ajustar a la ventana">
        Ajustar
      </button>
    </div>
  );
}
