import { useEffect, useRef, useState } from 'react';

interface SaveTemplateModalProps {
  open: boolean;
  defaultName: string;
  busy: boolean;
  /** Avisos de contenido que se limpiará al guardar (enlaces QR, etc.). */
  contentWarnings?: string[];
  onClose: () => void;
  onSave: (name: string) => void;
}

export function SaveTemplateModal({
  open,
  defaultName,
  busy,
  contentWarnings = [],
  onClose,
  onSave,
}: SaveTemplateModalProps) {
  const [name, setName] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(defaultName);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, defaultName]);

  if (!open) return null;

  return (
    <div className="app-dialog-overlay" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="app-dialog save-template-modal"
        role="dialog"
        aria-labelledby="save-template-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="save-template-title">Guardar como plantilla</h2>
        <p className="save-template-modal-hint">
          La plantilla se guardará en <strong>Mis plantillas</strong>. Podrás publicarla para que
          otros usuarios la usen desde Plantillas.
        </p>
        {contentWarnings.length > 0 && (
          <div className="save-template-modal-warnings" role="status">
            <p className="save-template-modal-warnings-title">Al guardar se limpiará:</p>
            <ul>
              {contentWarnings.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        <label className="save-template-modal-field">
          <span>Nombre</span>
          <input
            ref={inputRef}
            type="text"
            value={name}
            maxLength={120}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim() && !busy) onSave(name.trim());
            }}
          />
        </label>
        <div className="app-dialog-actions">
          <button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !name.trim()}
            onClick={() => onSave(name.trim())}
          >
            {busy ? 'Guardando…' : 'Guardar plantilla'}
          </button>
        </div>
      </div>
    </div>
  );
}
