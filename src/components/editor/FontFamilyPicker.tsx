import { useEffect, useId, useRef, useState } from 'react';
import { EDITOR_FONTS, ensureEditorFontLoaded } from '@/lib/google-fonts';

interface FontFamilyPickerProps {
  value: string;
  onChange: (fontFamily: string) => void;
  disabled?: boolean;
}

const PREVIEW_SAMPLE = 'Aa Bb 123 · Menú';

export function FontFamilyPicker({ value, onChange, disabled = false }: FontFamilyPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected =
    !value.trim()
      ? ({ label: 'Varias fuentes…', value: '' } as const)
      : (EDITOR_FONTS.find((f) => f.value === value) ??
        ({ label: value, value } as const));

  useEffect(() => {
    ensureEditorFontLoaded(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;

    for (const font of EDITOR_FONTS) {
      ensureEditorFontLoaded(font.value);
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function selectFont(fontFamily: string) {
    ensureEditorFontLoaded(fontFamily);
    onChange(fontFamily);
    setOpen(false);
  }

  return (
    <div className={`font-family-picker${open ? ' is-open' : ''}`} ref={rootRef}>
        <button
          type="button"
          className="font-family-picker-trigger"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((prev) => !prev)}
        >
        <span className="font-family-picker-trigger-main">
          <span className="font-family-picker-name">{selected.label}</span>
          <span
            className="font-family-picker-preview"
            style={{ fontFamily: `"${selected.value}", sans-serif` }}
          >
            {PREVIEW_SAMPLE}
          </span>
        </span>
        <span className="font-family-picker-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <ul id={listId} className="font-family-picker-list" role="listbox" aria-label="Fuentes">
          {EDITOR_FONTS.map((font) => {
            const isSelected = font.value === value;
            return (
              <li key={font.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`font-family-picker-option${isSelected ? ' is-selected' : ''}`}
                  onClick={() => selectFont(font.value)}
                  onMouseEnter={() => ensureEditorFontLoaded(font.value)}
                >
                  <span className="font-family-picker-option-meta">
                    <span className="font-family-picker-option-label">
                      {font.label}
                      {font.local ? ' (local)' : ''}
                    </span>
                  </span>
                  <span
                    className="font-family-picker-option-preview"
                    style={{ fontFamily: `"${font.value}", sans-serif` }}
                  >
                    {font.label}
                    <span className="font-family-picker-option-sample">{PREVIEW_SAMPLE}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
