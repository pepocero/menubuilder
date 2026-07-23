import { useEffect, useState } from 'react';
import {
  PAGE_SIZE_PRESETS,
  clampPageSizeCm,
  cmToPt,
  getPageSize,
  matchPageSizePreset,
  ptToCm,
  sizeFromPresetId,
} from '@/lib/page-size';
import type { MenuPage } from '@/types/canvas';

interface PageSizeControlsProps {
  page: MenuPage;
  pageIndex: number;
  onChange: (size: { width: number; height: number }) => void;
  disabled?: boolean;
}

export function PageSizeControls({
  page,
  pageIndex,
  onChange,
  disabled = false,
}: PageSizeControlsProps) {
  const { width, height } = getPageSize(page);
  const matched = matchPageSizePreset(width, height);
  const [presetId, setPresetId] = useState(matched);
  const [widthCm, setWidthCm] = useState(String(ptToCm(width)));
  const [heightCm, setHeightCm] = useState(String(ptToCm(height)));

  useEffect(() => {
    const size = getPageSize(page);
    setPresetId(matchPageSizePreset(size.width, size.height));
    setWidthCm(String(ptToCm(size.width)));
    setHeightCm(String(ptToCm(size.height)));
  }, [page.id, page.width, page.height]);

  function applySize(nextWidth: number, nextHeight: number) {
    onChange({ width: nextWidth, height: nextHeight });
  }

  function handlePresetChange(value: string) {
    setPresetId(value);
    if (value === 'custom') return;
    const size = sizeFromPresetId(value);
    if (!size) return;
    setWidthCm(String(ptToCm(size.width)));
    setHeightCm(String(ptToCm(size.height)));
    applySize(size.width, size.height);
  }

  function commitCustom() {
    const w = clampPageSizeCm(Number(widthCm.replace(',', '.')));
    const h = clampPageSizeCm(Number(heightCm.replace(',', '.')));
    setWidthCm(String(w));
    setHeightCm(String(h));
    setPresetId('custom');
    applySize(cmToPt(w), cmToPt(h));
  }

  return (
    <div className="page-size-controls">
      <h3>Tamaño de página {pageIndex + 1}</h3>
      <p className="panel-hint">
        Cada página puede tener un tamaño distinto. «Móvil pantalla completa» evita
        el scroll vertical en la carta pública con scroll horizontal.
      </p>

      <label>
        Formato
        <select
          value={presetId}
          disabled={disabled}
          onChange={(e) => handlePresetChange(e.target.value)}
        >
          {PAGE_SIZE_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </label>

      {(presetId === 'custom' || matched === 'custom') && (
        <div className="page-size-custom">
          <label>
            Ancho (cm)
            <input
              type="number"
              min={5}
              max={100}
              step={0.1}
              value={widthCm}
              disabled={disabled}
              onChange={(e) => {
                setPresetId('custom');
                setWidthCm(e.target.value);
              }}
              onBlur={commitCustom}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
            />
          </label>
          <label>
            Alto (cm)
            <input
              type="number"
              min={5}
              max={100}
              step={0.1}
              value={heightCm}
              disabled={disabled}
              onChange={(e) => {
                setPresetId('custom');
                setHeightCm(e.target.value);
              }}
              onBlur={commitCustom}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
            />
          </label>
          <button
            type="button"
            className="btn-secondary"
            disabled={disabled}
            onClick={commitCustom}
          >
            Aplicar cm
          </button>
        </div>
      )}

      <p className="page-size-current">
        Actual: {ptToCm(width)} × {ptToCm(height)} cm
      </p>
    </div>
  );
}
