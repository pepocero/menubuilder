import {
  PAGE_GAP_OPTIONS,
  type PageGap,
  type PageScrollDirection,
} from '@/types/canvas';

interface PublicScrollControlsProps {
  scroll: PageScrollDirection;
  onScrollChange: (value: PageScrollDirection) => void;
  gap: PageGap;
  onGapChange: (value: PageGap) => void;
  disabled?: boolean;
}

export function PublicScrollControls({
  scroll,
  onScrollChange,
  gap,
  onGapChange,
  disabled = false,
}: PublicScrollControlsProps) {
  return (
    <div className="page-size-controls">
      <h3>Vista pública</h3>
      <p className="panel-hint">
        Solo afecta a la carta publicada (QR). En horizontal: desliza entre páginas;
        cada página se encaja entera en pantalla (sin barras internas).
      </p>
      <label>
        Scroll de páginas
        <select
          value={scroll}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value === 'horizontal' ? 'horizontal' : 'vertical';
            onScrollChange(next);
          }}
        >
          <option value="vertical">Vertical</option>
          <option value="horizontal">Horizontal</option>
        </select>
      </label>
      <label>
        Separación entre páginas
        <select
          value={gap}
          disabled={disabled}
          onChange={(e) => {
            const next = Number(e.target.value) as PageGap;
            const match = PAGE_GAP_OPTIONS.find((o) => o.value === next);
            onGapChange(match ? match.value : 0);
          }}
        >
          {PAGE_GAP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
