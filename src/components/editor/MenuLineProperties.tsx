import { useState } from 'react';
import type { Group } from 'fabric';
import { ensureEditorFontLoaded } from '@/lib/google-fonts';
import { FontFamilyPicker } from '@/components/editor/FontFamilyPicker';
import { getLayerObjectData } from '@/lib/layer-utils';
import {
  addMenuLineRow,
  getMenuLineColumn,
  getMenuLineLeader,
  getMenuLineLeftWidth,
  getMenuLineRowCount,
  getMenuLineRowGap,
  MENU_LINE_COLUMN_KEYS,
  MENU_LINE_LEADER_OPTIONS,
  menuLineColumnLabel,
  removeMenuLineRow,
  updateMenuLineColumnContent,
  updateMenuLineColumnRatio,
  updateMenuLineColumnStyle,
  updateMenuLineIngredientsContent,
  updateMenuLineLeader,
  updateMenuLineRowGap,
} from '@/lib/menu-line';
import type { MenuLineColumnKey, MenuLineLeader } from '@/types/canvas';

interface MenuLinePropertiesProps {
  group: Group;
  onUpdate: () => void;
}

/** Valor del desplegable: índice o todas las filas. */
type RowSelection = number | 'all';

function readRowLeader(group: Group, rowIndex: number): MenuLineLeader {
  const center = getMenuLineColumn(group, 'center', rowIndex);
  if (!center) return getMenuLineLeader(group);
  const raw = getLayerObjectData(center).menuLineLeader;
  if (raw === 'dots' || raw === 'dashes' || raw === 'spaces' || raw === 'custom') return raw;
  return getMenuLineLeader(group);
}

function sharedStyleValue<T>(
  values: T[],
  empty: T,
): { value: T; mixed: boolean } {
  if (values.length === 0) return { value: empty, mixed: false };
  const first = values[0];
  const mixed = values.some((v) => v !== first);
  return { value: first, mixed };
}

export function MenuLineProperties({ group, onUpdate }: MenuLinePropertiesProps) {
  const [activeColumn, setActiveColumn] = useState<MenuLineColumnKey>('left');
  const [activeRow, setActiveRow] = useState<RowSelection>(0);
  const [, setTick] = useState(0);

  function refresh() {
    setTick((t) => t + 1);
    onUpdate();
  }

  const rowCount = getMenuLineRowCount(group);
  const applyAll = activeRow === 'all';
  const rowIndex = applyAll ? 0 : Math.min(activeRow, Math.max(0, rowCount - 1));
  const styleTarget: number | 'all' = applyAll ? 'all' : rowIndex;

  const previewBox = getMenuLineColumn(group, activeColumn, rowIndex);
  const leftWidth = getMenuLineLeftWidth(group);
  const totalWidth = Math.max(
    1,
    (group.width ?? 0) * (group.scaleX ?? 1),
  );
  const leftPercent = Math.round((leftWidth / totalWidth) * 100);
  const rowGap = getMenuLineRowGap(group);

  if (!previewBox) {
    return <p className="panel-empty">No se pudo leer la línea de carta.</p>;
  }

  const columnBoxes = Array.from({ length: rowCount }, (_, i) =>
    getMenuLineColumn(group, activeColumn, i),
  ).filter((b): b is NonNullable<typeof b> => !!b);

  const fontFamilyInfo = sharedStyleValue(
    columnBoxes.map((b) => b.fontFamily ?? 'Arial'),
    'Arial',
  );
  const fontSizeInfo = sharedStyleValue(
    columnBoxes.map((b) => Math.round(b.fontSize ?? 18)),
    18,
  );
  const fillInfo = sharedStyleValue(
    columnBoxes.map((b) =>
      typeof b.fill === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(b.fill)
        ? b.fill
        : '#333333',
    ),
    '#333333',
  );
  const boldInfo = sharedStyleValue(
    columnBoxes.map(
      (b) => String(b.fontWeight ?? 'normal') === 'bold' || b.fontWeight === 700,
    ),
    false,
  );
  const italicInfo = sharedStyleValue(
    columnBoxes.map(
      (b) => b.fontStyle === 'italic' || b.fontStyle === 'oblique',
    ),
    false,
  );
  const alignInfo = sharedStyleValue(
    columnBoxes.map((b) => (b.textAlign as 'left' | 'center' | 'right') ?? 'left'),
    'left' as const,
  );
  const leaderInfo = sharedStyleValue(
    Array.from({ length: rowCount }, (_, i) => readRowLeader(group, i)),
    'dots' as MenuLineLeader,
  );

  const displayFontFamily = applyAll ? fontFamilyInfo.value : (previewBox.fontFamily ?? 'Arial');
  const displayFontSize = applyAll
    ? fontSizeInfo.value
    : Math.round(previewBox.fontSize ?? 18);
  const displayFill = applyAll
    ? fillInfo.value
    : typeof previewBox.fill === 'string' &&
        /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(previewBox.fill)
      ? previewBox.fill
      : '#333333';
  const isBold = applyAll
    ? boldInfo.value
    : String(previewBox.fontWeight ?? 'normal') === 'bold' || previewBox.fontWeight === 700;
  const isItalic = applyAll
    ? italicInfo.value
    : previewBox.fontStyle === 'italic' || previewBox.fontStyle === 'oblique';
  const displayAlign = applyAll
    ? alignInfo.value
    : ((previewBox.textAlign as 'left' | 'center' | 'right') ?? 'left');
  const leader = applyAll ? leaderInfo.value : readRowLeader(group, rowIndex);
  const ingredientsBox = applyAll
    ? null
    : getMenuLineColumn(group, 'ingredients', rowIndex);
  const ingredientsText = ingredientsBox?.text ?? '';

  return (
    <div className="menu-line-properties">
      <p className="panel-hint">
        El ancho del bloque se cambia con las asas del lienzo (solo el contenedor). Plato: ancho
        fijo. Precio: al contenido. Separador: rellena el resto. Ingredientes (opcional) debajo a
        ancho completo. «Todas» aplica formato a una columna en todas las filas.
      </p>

      <div className="menu-line-row-controls">
        <label>
          Fila
          <select
            value={applyAll ? 'all' : String(rowIndex)}
            onChange={(e) => {
              const v = e.target.value;
              setActiveRow(v === 'all' ? 'all' : Number(v));
            }}
          >
            <option value="all">Todas</option>
            {Array.from({ length: rowCount }, (_, i) => (
              <option key={i} value={i}>
                Fila {i + 1}
              </option>
            ))}
          </select>
        </label>
        <div className="menu-line-row-actions">
          <button
            type="button"
            className="btn-secondary"
            title="Añadir fila con el mismo formato"
            onClick={() => {
              addMenuLineRow(group);
              setActiveRow(getMenuLineRowCount(group) - 1);
              refresh();
            }}
          >
            + Fila
          </button>
          <button
            type="button"
            className="btn-secondary"
            title="Eliminar esta fila"
            disabled={applyAll || rowCount <= 1}
            onClick={() => {
              removeMenuLineRow(group, rowIndex);
              setActiveRow((prev) => {
                if (prev === 'all') return 'all';
                return Math.max(0, Math.min(prev, getMenuLineRowCount(group) - 1));
              });
              refresh();
            }}
          >
            − Fila
          </button>
        </div>
      </div>

      <label>
        Espacio entre filas
        <input
          type="range"
          min={0}
          max={24}
          step={1}
          value={rowGap}
          onChange={(e) => {
            updateMenuLineRowGap(group, Number(e.target.value));
            refresh();
          }}
        />
      </label>

      <div className="menu-line-column-tabs" role="tablist" aria-label="Columna">
        {MENU_LINE_COLUMN_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeColumn === key}
            className={
              activeColumn === key
                ? 'menu-line-column-tab is-active'
                : 'menu-line-column-tab'
            }
            onClick={() => setActiveColumn(key)}
          >
            {menuLineColumnLabel(key)}
          </button>
        ))}
      </div>

      {activeColumn === 'center' && (
        <label>
          Tipo de separador {applyAll ? '(todas las filas)' : '(esta fila)'}
          <select
            value={leader}
            onChange={(e) => {
              updateMenuLineLeader(
                group,
                e.target.value as MenuLineLeader,
                applyAll ? 'all' : rowIndex,
              );
              refresh();
            }}
          >
            {MENU_LINE_LEADER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {applyAll && activeColumn === 'center' && leaderInfo.mixed && (
        <p className="panel-hint">Había separadores distintos; el valor mostrado es el de la primera fila.</p>
      )}

      <label>
        Texto ({menuLineColumnLabel(activeColumn)}
        {applyAll ? ', todas' : `, fila ${rowIndex + 1}`})
        <input
          type="text"
          value={applyAll ? '' : (previewBox.text ?? '')}
          disabled={applyAll}
          placeholder={applyAll ? 'Elige una fila para editar el texto' : undefined}
          onChange={(e) => {
            if (applyAll) return;
            updateMenuLineColumnContent(group, activeColumn, e.target.value, rowIndex);
            refresh();
          }}
        />
      </label>

      {!applyAll && (
        <label>
          Ingredientes (fila {rowIndex + 1})
          <input
            type="text"
            value={ingredientsText}
            placeholder="Mozzarella - Tomàquet - … (opcional)"
            onChange={(e) => {
              updateMenuLineIngredientsContent(group, e.target.value, rowIndex);
              refresh();
            }}
          />
        </label>
      )}

      {activeColumn === 'left' ? (
        <label>
          Ancho columna plato ({leftPercent}%)
          <input
            type="range"
            min={15}
            max={75}
            step={1}
            value={leftPercent}
            onChange={(e) => {
              updateMenuLineColumnRatio(group, 'left', Number(e.target.value) / 100);
              refresh();
            }}
          />
        </label>
      ) : (
        <p className="panel-hint">
          {activeColumn === 'right'
            ? 'El ancho del precio se ajusta solo al texto.'
            : 'El separador ocupa el espacio que queda entre plato y precio.'}
        </p>
      )}

      <label>
        Fuente
        {applyAll && fontFamilyInfo.mixed ? ' (varias)' : ''}
        <FontFamilyPicker
          value={displayFontFamily}
          onChange={(fontFamily) => {
            ensureEditorFontLoaded(fontFamily);
            updateMenuLineColumnStyle(group, activeColumn, { fontFamily }, styleTarget);
            refresh();
          }}
        />
      </label>

      <label>
        Tamaño
        {applyAll && fontSizeInfo.mixed ? ' (varios)' : ''}
        <input
          type="number"
          min={8}
          max={120}
          value={displayFontSize}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!Number.isFinite(next)) return;
            updateMenuLineColumnStyle(
              group,
              activeColumn,
              { fontSize: Math.max(8, Math.min(120, next)) },
              styleTarget,
            );
            refresh();
          }}
        />
      </label>

      <label>
        Color
        {applyAll && fillInfo.mixed ? ' (varios)' : ''}
        <input
          type="color"
          value={displayFill}
          onChange={(e) => {
            updateMenuLineColumnStyle(group, activeColumn, { color: e.target.value }, styleTarget);
            refresh();
          }}
        />
      </label>

      <div className="properties-text-style-row" onMouseDown={(e) => e.preventDefault()}>
        <button
          type="button"
          className={isBold && !(applyAll && boldInfo.mixed) ? 'is-active' : undefined}
          title={applyAll ? 'Negrita en todas las filas de esta columna' : 'Negrita'}
          onClick={() => {
            const turnOff = applyAll ? isBold && !boldInfo.mixed : isBold;
            updateMenuLineColumnStyle(
              group,
              activeColumn,
              { fontWeight: turnOff ? 'normal' : 'bold' },
              styleTarget,
            );
            refresh();
          }}
        >
          <strong>N</strong>
        </button>
        <button
          type="button"
          className={isItalic && !(applyAll && italicInfo.mixed) ? 'is-active' : undefined}
          title={applyAll ? 'Cursiva en todas las filas de esta columna' : 'Cursiva'}
          onClick={() => {
            const turnOff = applyAll ? isItalic && !italicInfo.mixed : isItalic;
            updateMenuLineColumnStyle(
              group,
              activeColumn,
              { fontStyle: turnOff ? 'normal' : 'italic' },
              styleTarget,
            );
            refresh();
          }}
        >
          <em>C</em>
        </button>
      </div>

      <label>
        Alineación en columna
        {applyAll && alignInfo.mixed ? ' (varias)' : ''}
        <select
          value={displayAlign}
          onChange={(e) => {
            const align = e.target.value as 'left' | 'center' | 'right';
            updateMenuLineColumnStyle(group, activeColumn, { align }, styleTarget);
            refresh();
          }}
        >
          <option value="left">Izquierda</option>
          <option value="center">Centro</option>
          <option value="right">Derecha</option>
        </select>
      </label>
    </div>
  );
}
