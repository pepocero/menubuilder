import { useState, type ReactNode } from 'react';
import type { Group } from 'fabric';
import { ensureEditorFontLoaded } from '@/lib/google-fonts';
import { FontFamilyPicker } from '@/components/editor/FontFamilyPicker';
import { getLayerObjectData } from '@/lib/layer-utils';
import {
  addMenuLineRow,
  getMenuLineBlankLinesAfter,
  getMenuLineColumn,
  getMenuLineLeader,
  getMenuLineLeaderUnit,
  getMenuLineLeftWidth,
  getMenuLineRowCount,
  getMenuLineRowGap,
  MENU_LINE_COLUMN_KEYS,
  MENU_LINE_LEADER_OPTIONS,
  MENU_LINE_MAX_BLANK_LINES,
  menuLineColumnLabel,
  removeMenuLineRow,
  updateMenuLineBlankLinesAfter,
  updateMenuLineColumnContent,
  updateMenuLineColumnRatio,
  updateMenuLineColumnStyle,
  updateMenuLineIngredientsContent,
  updateMenuLineIngredientsStyle,
  updateMenuLineLeader,
  updateMenuLineLeaderUnit,
  updateMenuLineRowGap,
} from '@/lib/menu-line';
import type { MenuLineColumnKey, MenuLineColumnStyle, MenuLineLeader } from '@/types/canvas';

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

function readBoxTextAlign(box: { textAlign?: string } | null): MenuLineColumnStyle['align'] {
  const raw = box?.textAlign;
  if (raw === 'center' || raw === 'right' || raw === 'justify' || raw === 'left') return raw;
  return 'left';
}

function readIngredientsBoxAlign(
  box: Parameters<typeof getLayerObjectData>[0] | null,
): MenuLineColumnStyle['align'] {
  if (!box) return 'left';
  const stored = getLayerObjectData(box).menuLineTextAlign;
  if (stored === 'center' || stored === 'right' || stored === 'justify' || stored === 'left') {
    return stored;
  }
  return readBoxTextAlign(box as { textAlign?: string });
}

const INGREDIENT_ALIGN_OPTIONS = [
  {
    value: 'left' as const,
    title: 'Alinear ingredientes a la izquierda',
    icon: (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <rect x="1" y="2" width="14" height="1.5" fill="currentColor" />
        <rect x="1" y="5.5" width="9" height="1.5" fill="currentColor" />
        <rect x="1" y="9" width="14" height="1.5" fill="currentColor" />
        <rect x="1" y="12.5" width="9" height="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    value: 'center' as const,
    title: 'Centrar ingredientes',
    icon: (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <rect x="1" y="2" width="14" height="1.5" fill="currentColor" />
        <rect x="3.5" y="5.5" width="9" height="1.5" fill="currentColor" />
        <rect x="1" y="9" width="14" height="1.5" fill="currentColor" />
        <rect x="3.5" y="12.5" width="9" height="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    value: 'right' as const,
    title: 'Alinear ingredientes a la derecha',
    icon: (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <rect x="1" y="2" width="14" height="1.5" fill="currentColor" />
        <rect x="6" y="5.5" width="9" height="1.5" fill="currentColor" />
        <rect x="1" y="9" width="14" height="1.5" fill="currentColor" />
        <rect x="6" y="12.5" width="9" height="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    value: 'justify' as const,
    title: 'Justificar ingredientes',
    icon: (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <rect x="1" y="2" width="14" height="1.5" fill="currentColor" />
        <rect x="1" y="5.5" width="14" height="1.5" fill="currentColor" />
        <rect x="1" y="9" width="14" height="1.5" fill="currentColor" />
        <rect x="1" y="12.5" width="14" height="1.5" fill="currentColor" />
      </svg>
    ),
  },
] satisfies Array<{
  value: MenuLineColumnStyle['align'];
  title: string;
  icon: ReactNode;
}>;

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
    columnBoxes.map((b) => {
      const align = b.textAlign;
      return align === 'center' || align === 'right' || align === 'justify' || align === 'left'
        ? align
        : 'left';
    }),
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
    : previewBox.textAlign === 'center' ||
        previewBox.textAlign === 'right' ||
        previewBox.textAlign === 'justify' ||
        previewBox.textAlign === 'left'
      ? previewBox.textAlign
      : 'left';
  const leader = applyAll ? leaderInfo.value : readRowLeader(group, rowIndex);
  const ingredientsBoxes = Array.from({ length: rowCount }, (_, i) =>
    getMenuLineColumn(group, 'ingredients', i),
  );
  const ingredientsAlignInfo = sharedStyleValue(
    ingredientsBoxes
      .filter((box): box is NonNullable<typeof box> => !!box)
      .map((box) => readIngredientsBoxAlign(box)),
    'left' as MenuLineColumnStyle['align'],
  );
  const ingredientsBox = applyAll ? null : ingredientsBoxes[rowIndex] ?? null;
  const ingredientsText = ingredientsBox?.text ?? '';
  const hasIngredientsInScope = applyAll
    ? ingredientsBoxes.some((box) => !!(box?.text ?? '').trim())
    : !!ingredientsText.trim();
  const ingredientsAlign = applyAll
    ? ingredientsAlignInfo.value
    : readIngredientsBoxAlign(ingredientsBox);
  const ingredientsPresentBoxes = ingredientsBoxes.filter(
    (box): box is NonNullable<typeof box> => !!box && !!(box.text ?? '').trim(),
  );
  const ingredientsFontSizeInfo = sharedStyleValue(
    ingredientsPresentBoxes.map((box) => Math.round(box.fontSize ?? 14)),
    14,
  );
  const ingredientsBoldInfo = sharedStyleValue(
    ingredientsPresentBoxes.map(
      (box) => String(box.fontWeight ?? 'normal') === 'bold' || box.fontWeight === 700,
    ),
    false,
  );
  const ingredientsItalicInfo = sharedStyleValue(
    ingredientsPresentBoxes.map(
      (box) => box.fontStyle === 'italic' || box.fontStyle === 'oblique',
    ),
    false,
  );
  const ingredientsFontSize = applyAll
    ? ingredientsFontSizeInfo.value
    : Math.round(ingredientsBox?.fontSize ?? ingredientsFontSizeInfo.value);
  const ingredientsIsBold = applyAll
    ? ingredientsBoldInfo.value
    : String(ingredientsBox?.fontWeight ?? 'normal') === 'bold' ||
      ingredientsBox?.fontWeight === 700;
  const ingredientsIsItalic = applyAll
    ? ingredientsItalicInfo.value
    : ingredientsBox?.fontStyle === 'italic' || ingredientsBox?.fontStyle === 'oblique';
  const blankLinesInfo = sharedStyleValue(
    Array.from({ length: rowCount }, (_, i) => getMenuLineBlankLinesAfter(group, i)),
    0,
  );
  const blankLinesAfter = applyAll
    ? blankLinesInfo.value
    : getMenuLineBlankLinesAfter(group, rowIndex);
  const leaderUnitInfo = sharedStyleValue(
    Array.from({ length: rowCount }, (_, i) => getMenuLineLeaderUnit(group, i)),
    '·',
  );
  const leaderUnit = applyAll
    ? leaderUnitInfo.value
    : getMenuLineLeaderUnit(group, rowIndex);

  const columnLabel = menuLineColumnLabel(activeColumn);
  const rowScopeLabel = applyAll ? 'todas las filas' : `fila ${rowIndex + 1}`;

  return (
    <div className="menu-line-properties">
      <p className="panel-hint">
        Cada bloque de abajo es independiente. Plato / Separador / Precio cambian solo la columna
        activa; Ingredientes tiene su propio formato.
      </p>

      <section className="menu-line-prop-block menu-line-prop-block--structure">
        <header className="menu-line-prop-block-header">
          <span className="menu-line-prop-block-title">Estructura</span>
          <span className="menu-line-prop-block-sub">Bloque completo</span>
        </header>

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

        <label className="menu-line-width-control">
          Ancho columna plato ({leftPercent}%)
          <input
            type="range"
            min={15}
            max={75}
            step={1}
            value={Math.min(75, Math.max(15, leftPercent))}
            onChange={(e) => {
              updateMenuLineColumnRatio(group, 'left', Number(e.target.value) / 100);
              refresh();
            }}
          />
        </label>

        <div className="menu-line-row-controls">
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
        </div>
      </section>

      <section className="menu-line-prop-block menu-line-prop-block--spacing">
        <header className="menu-line-prop-block-header">
          <span className="menu-line-prop-block-title">Espaciado</span>
          <span className="menu-line-prop-block-sub">{rowScopeLabel}</span>
        </header>
        <label>
          Saltos después {applyAll ? '(todas las filas)' : `de la fila ${rowIndex + 1}`}
          {applyAll && blankLinesInfo.mixed ? ' (varios)' : ''}
          <input
            type="number"
            min={0}
            max={MENU_LINE_MAX_BLANK_LINES}
            step={1}
            value={blankLinesAfter}
            title="Líneas en blanco tras el plato (y sus ingredientes), antes del siguiente"
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isFinite(next)) return;
              updateMenuLineBlankLinesAfter(
                group,
                applyAll ? 'all' : rowIndex,
                next,
              );
              refresh();
            }}
          />
        </label>
        {applyAll && blankLinesInfo.mixed && (
          <p className="panel-hint">
            Había saltos distintos por fila; el valor mostrado es el de la primera. Al cambiarlo se
            aplica a todas.
          </p>
        )}
      </section>

      <section
        className={`menu-line-prop-block menu-line-prop-block--column menu-line-prop-block--${activeColumn}`}
        data-column={activeColumn}
      >
        <header className="menu-line-prop-block-header">
          <span className="menu-line-prop-block-title">Columna: {columnLabel}</span>
          <span className="menu-line-prop-block-sub">{rowScopeLabel}</span>
        </header>

        <div className="menu-line-column-tabs" role="tablist" aria-label="Columna">
          {MENU_LINE_COLUMN_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeColumn === key}
              className={
                activeColumn === key
                  ? `menu-line-column-tab menu-line-column-tab--${key} is-active`
                  : `menu-line-column-tab menu-line-column-tab--${key}`
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
          <p className="panel-hint">
            Había separadores distintos; el valor mostrado es el de la primera fila.
          </p>
        )}

        {activeColumn === 'center' && leader === 'custom' ? (
          <>
            <label>
              Símbolo del separador
              {applyAll ? ' (todas las filas)' : ` (fila ${rowIndex + 1})`}
              {applyAll && leaderUnitInfo.mixed ? ' (varios)' : ''}
              <input
                type="text"
                maxLength={4}
                value={leaderUnit}
                placeholder="·"
                title="Un solo símbolo; se repite solo hasta llenar el espacio"
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (!raw.trim()) {
                    updateMenuLineLeaderUnit(group, '·', applyAll ? 'all' : rowIndex);
                    refresh();
                    return;
                  }
                  updateMenuLineLeaderUnit(group, raw, applyAll ? 'all' : rowIndex);
                  refresh();
                }}
              />
            </label>
            <p className="panel-hint">
              Escribe un símbolo (p. ej. · * ~ •). Se repite entre plato y precio.
            </p>
          </>
        ) : activeColumn === 'center' ? (
          <p className="panel-hint">
            El separador se rellena solo. Elige «Personalizado» para otro símbolo.
          </p>
        ) : (
          <label>
            Texto ({columnLabel}
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
        )}

        {activeColumn === 'right' && (
          <p className="panel-hint">El ancho del precio se ajusta solo al texto.</p>
        )}
        {activeColumn === 'center' && (
          <p className="panel-hint">
            El separador ocupa el espacio que queda entre plato y precio.
          </p>
        )}

        <p className="menu-line-prop-section-label">
          Tipografía de {columnLabel}
        </p>

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
          <div className="properties-font-size-row">
            <button
              type="button"
              className="properties-font-size-step"
              title={`Reducir tamaño de ${columnLabel}`}
              onClick={() => {
                const base = Math.round(displayFontSize);
                updateMenuLineColumnStyle(
                  group,
                  activeColumn,
                  { fontSize: Math.max(8, Math.min(120, base - 1)) },
                  styleTarget,
                );
                refresh();
              }}
            >
              −
            </button>
            <input
              type={applyAll && fontSizeInfo.mixed ? 'text' : 'number'}
              min={8}
              max={120}
              step={1}
              inputMode="numeric"
              value={applyAll && fontSizeInfo.mixed ? '–' : displayFontSize}
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
            <button
              type="button"
              className="properties-font-size-step"
              title={`Aumentar tamaño de ${columnLabel}`}
              onClick={() => {
                const base = Math.round(displayFontSize);
                updateMenuLineColumnStyle(
                  group,
                  activeColumn,
                  { fontSize: Math.max(8, Math.min(120, base + 1)) },
                  styleTarget,
                );
                refresh();
              }}
            >
              +
            </button>
          </div>
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

        <div
          className="properties-text-style-row"
          role="group"
          aria-label={`Estilo de ${columnLabel}`}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className={isBold && !(applyAll && boldInfo.mixed) ? 'is-active' : undefined}
            title={
              applyAll
                ? `Negrita en ${columnLabel} (todas las filas)`
                : `Negrita en ${columnLabel}`
            }
            aria-pressed={isBold && !(applyAll && boldInfo.mixed)}
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
            title={
              applyAll
                ? `Cursiva en ${columnLabel} (todas las filas)`
                : `Cursiva en ${columnLabel}`
            }
            aria-pressed={isItalic && !(applyAll && italicInfo.mixed)}
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

        <div
          className="properties-align-row"
          role="group"
          aria-label={`Alineación de ${columnLabel}`}
        >
          <button
            type="button"
            className={
              displayAlign === 'left' && !(applyAll && alignInfo.mixed) ? 'is-active' : undefined
            }
            title="Alinear a la izquierda"
            aria-pressed={displayAlign === 'left' && !(applyAll && alignInfo.mixed)}
            onClick={() => {
              updateMenuLineColumnStyle(group, activeColumn, { align: 'left' }, styleTarget);
              refresh();
            }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <rect x="1" y="2" width="14" height="1.5" fill="currentColor" />
              <rect x="1" y="5.5" width="9" height="1.5" fill="currentColor" />
              <rect x="1" y="9" width="14" height="1.5" fill="currentColor" />
              <rect x="1" y="12.5" width="9" height="1.5" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className={
              displayAlign === 'center' && !(applyAll && alignInfo.mixed) ? 'is-active' : undefined
            }
            title="Centrar"
            aria-pressed={displayAlign === 'center' && !(applyAll && alignInfo.mixed)}
            onClick={() => {
              updateMenuLineColumnStyle(group, activeColumn, { align: 'center' }, styleTarget);
              refresh();
            }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <rect x="1" y="2" width="14" height="1.5" fill="currentColor" />
              <rect x="3.5" y="5.5" width="9" height="1.5" fill="currentColor" />
              <rect x="1" y="9" width="14" height="1.5" fill="currentColor" />
              <rect x="3.5" y="12.5" width="9" height="1.5" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className={
              displayAlign === 'right' && !(applyAll && alignInfo.mixed) ? 'is-active' : undefined
            }
            title="Alinear a la derecha"
            aria-pressed={displayAlign === 'right' && !(applyAll && alignInfo.mixed)}
            onClick={() => {
              updateMenuLineColumnStyle(group, activeColumn, { align: 'right' }, styleTarget);
              refresh();
            }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <rect x="1" y="2" width="14" height="1.5" fill="currentColor" />
              <rect x="6" y="5.5" width="9" height="1.5" fill="currentColor" />
              <rect x="1" y="9" width="14" height="1.5" fill="currentColor" />
              <rect x="6" y="12.5" width="9" height="1.5" fill="currentColor" />
            </svg>
          </button>
        </div>
        {applyAll && alignInfo.mixed && (
          <p className="panel-hint">
            Había alineaciones distintas; elige un icono para unificarlas.
          </p>
        )}
      </section>

      <section className="menu-line-prop-block menu-line-prop-block--ingredients">
        <header className="menu-line-prop-block-header">
          <span className="menu-line-prop-block-title">Ingredientes</span>
          <span className="menu-line-prop-block-sub">{rowScopeLabel}</span>
        </header>
        <p className="panel-hint">
          Independiente de Plato / Separador / Precio. Se muestran debajo de cada plato.
        </p>

        {!applyAll && (
          <label>
            Texto (fila {rowIndex + 1})
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
        {applyAll && (
          <p className="panel-hint">Con «Todas» puedes unificar el formato de ingredientes.</p>
        )}

        <p className="menu-line-prop-section-label">Alineación</p>
        <div
          className="properties-align-row"
          role="group"
          aria-label={
            applyAll
              ? 'Alineación de ingredientes (todas las filas)'
              : 'Alineación de ingredientes'
          }
        >
          {INGREDIENT_ALIGN_OPTIONS.map((item) => {
            const active =
              ingredientsAlign === item.value &&
              !(applyAll && ingredientsAlignInfo.mixed);
            return (
              <button
                key={item.value}
                type="button"
                className={active ? 'is-active' : undefined}
                title={item.title}
                aria-label={item.title}
                aria-pressed={active}
                disabled={!hasIngredientsInScope}
                onClick={() => {
                  updateMenuLineIngredientsStyle(
                    group,
                    { align: item.value },
                    applyAll ? 'all' : rowIndex,
                  );
                  refresh();
                }}
              >
                {item.icon}
              </button>
            );
          })}
        </div>
        {applyAll && ingredientsAlignInfo.mixed && (
          <p className="panel-hint">
            Había alineaciones distintas; elige un icono para unificarlas.
          </p>
        )}

        <label>
          Tamaño
          {applyAll && ingredientsFontSizeInfo.mixed ? ' (varios)' : ''}
          <div className="properties-font-size-row">
            <button
              type="button"
              className="properties-font-size-step"
              title="Reducir tamaño de ingredientes"
              disabled={!hasIngredientsInScope}
              onClick={() => {
                const base = Math.round(ingredientsFontSize);
                updateMenuLineIngredientsStyle(
                  group,
                  { fontSize: Math.max(8, Math.min(120, base - 1)) },
                  applyAll ? 'all' : rowIndex,
                );
                refresh();
              }}
            >
              −
            </button>
            <input
              type={applyAll && ingredientsFontSizeInfo.mixed ? 'text' : 'number'}
              min={8}
              max={120}
              step={1}
              inputMode="numeric"
              disabled={!hasIngredientsInScope}
              value={
                applyAll && ingredientsFontSizeInfo.mixed
                  ? '–'
                  : Math.round(ingredientsFontSize)
              }
              title="Tamaño de fuente de los ingredientes"
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next)) return;
                updateMenuLineIngredientsStyle(
                  group,
                  { fontSize: Math.max(8, Math.min(120, next)) },
                  applyAll ? 'all' : rowIndex,
                );
                refresh();
              }}
            />
            <button
              type="button"
              className="properties-font-size-step"
              title="Aumentar tamaño de ingredientes"
              disabled={!hasIngredientsInScope}
              onClick={() => {
                const base = Math.round(ingredientsFontSize);
                updateMenuLineIngredientsStyle(
                  group,
                  { fontSize: Math.max(8, Math.min(120, base + 1)) },
                  applyAll ? 'all' : rowIndex,
                );
                refresh();
              }}
            >
              +
            </button>
          </div>
        </label>

        <div
          className="properties-text-style-row"
          role="group"
          aria-label="Estilo de ingredientes"
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className={
              ingredientsIsBold && !(applyAll && ingredientsBoldInfo.mixed)
                ? 'is-active'
                : undefined
            }
            title={
              applyAll
                ? 'Negrita en ingredientes de todas las filas'
                : 'Negrita en ingredientes'
            }
            aria-pressed={
              ingredientsIsBold && !(applyAll && ingredientsBoldInfo.mixed)
            }
            disabled={!hasIngredientsInScope}
            onClick={() => {
              const turnOff = applyAll
                ? ingredientsIsBold && !ingredientsBoldInfo.mixed
                : ingredientsIsBold;
              updateMenuLineIngredientsStyle(
                group,
                { fontWeight: turnOff ? 'normal' : 'bold' },
                applyAll ? 'all' : rowIndex,
              );
              refresh();
            }}
          >
            <strong>N</strong>
          </button>
          <button
            type="button"
            className={
              ingredientsIsItalic && !(applyAll && ingredientsItalicInfo.mixed)
                ? 'is-active'
                : undefined
            }
            title={
              applyAll
                ? 'Cursiva en ingredientes de todas las filas'
                : 'Cursiva en ingredientes'
            }
            aria-pressed={
              ingredientsIsItalic && !(applyAll && ingredientsItalicInfo.mixed)
            }
            disabled={!hasIngredientsInScope}
            onClick={() => {
              const turnOff = applyAll
                ? ingredientsIsItalic && !ingredientsItalicInfo.mixed
                : ingredientsIsItalic;
              updateMenuLineIngredientsStyle(
                group,
                { fontStyle: turnOff ? 'normal' : 'italic' },
                applyAll ? 'all' : rowIndex,
              );
              refresh();
            }}
          >
            <em>C</em>
          </button>
        </div>
        {applyAll &&
          (ingredientsFontSizeInfo.mixed ||
            ingredientsBoldInfo.mixed ||
            ingredientsItalicInfo.mixed) && (
            <p className="panel-hint">
              Había estilos distintos en ingredientes; al cambiarlos se unifican.
            </p>
          )}
      </section>
    </div>
  );
}
