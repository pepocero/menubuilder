import type { PageScrollDirection } from '@/types/canvas';

interface PublicScrollControlsProps {
  value: PageScrollDirection;
  onChange: (value: PageScrollDirection) => void;
  disabled?: boolean;
}

export function PublicScrollControls({
  value,
  onChange,
  disabled = false,
}: PublicScrollControlsProps) {
  return (
    <div className="page-size-controls">
      <h3>Vista pública</h3>
      <p className="panel-hint">
        Solo afecta a la carta publicada (QR). El editor no cambia.
      </p>
      <label>
        Scroll de páginas
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value === 'horizontal' ? 'horizontal' : 'vertical';
            onChange(next);
          }}
        >
          <option value="vertical">Vertical</option>
          <option value="horizontal">Horizontal</option>
        </select>
      </label>
    </div>
  );
}
