import { useCallback, useEffect, useState } from 'react';
import { ApiError, listAssets, type AssetSummary } from '@/lib/api';
import {
  DEFAULT_OCR_LANGUAGE,
  OCR_LANGUAGE_PRESETS,
  type OcrLanguagePresetId,
} from '@/lib/menu-image-import';

export interface ImportMenuOptions {
  groupByTitles: boolean;
  ocrLanguage: OcrLanguagePresetId;
}

export type ImportMenuSource =
  | { type: 'file'; file: File }
  | { type: 'asset'; asset: AssetSummary };

interface ImportMenuModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (source: ImportMenuSource, options: ImportMenuOptions) => void;
  busy?: boolean;
  pageIndex: number;
}

type SourceTab = 'upload' | 'library';

const OCR_LANG_STORAGE_KEY = 'menubuilder.ocrLanguage';

function readStoredOcrLanguage(): OcrLanguagePresetId {
  try {
    const raw = localStorage.getItem(OCR_LANG_STORAGE_KEY);
    if (raw && OCR_LANGUAGE_PRESETS.some((p) => p.id === raw)) {
      return raw as OcrLanguagePresetId;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_OCR_LANGUAGE;
}

function assetDisplayName(asset: AssetSummary): string {
  const key = asset.r2_key ?? '';
  const parts = key.split('/');
  const file = parts[parts.length - 1] || asset.id;
  try {
    return decodeURIComponent(file);
  } catch {
    return file;
  }
}

export function ImportMenuModal({
  open,
  onClose,
  onImport,
  busy = false,
  pageIndex,
}: ImportMenuModalProps) {
  const [tab, setTab] = useState<SourceTab>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [groupByTitles, setGroupByTitles] = useState(true);
  const [ocrLanguage, setOcrLanguage] = useState<OcrLanguagePresetId>(DEFAULT_OCR_LANGUAGE);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? null;
  const selectedLangHint =
    OCR_LANGUAGE_PRESETS.find((p) => p.id === ocrLanguage)?.hint ?? '';

  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    setAssetsError('');
    try {
      const result = await listAssets();
      setAssets(result.assets.filter((a) => !!a.url));
    } catch (err) {
      setAssetsError(err instanceof ApiError ? err.message : 'No se pudieron cargar los archivos');
    } finally {
      setAssetsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setGroupByTitles(true);
      setTab('upload');
      setSelectedAssetId(null);
      setAssetsError('');
      return;
    }
    setOcrLanguage(readStoredOcrLanguage());
  }, [open]);

  useEffect(() => {
    if (open && tab === 'library') {
      void loadAssets();
    }
  }, [open, tab, loadAssets]);

  function handleLanguageChange(value: string) {
    if (!OCR_LANGUAGE_PRESETS.some((p) => p.id === value)) return;
    const id = value as OcrLanguagePresetId;
    setOcrLanguage(id);
    try {
      localStorage.setItem(OCR_LANG_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected && selected.type.startsWith('image/')) {
      setFile(selected);
      setSelectedAssetId(null);
    }
    e.target.value = '';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const options: ImportMenuOptions = { groupByTitles, ocrLanguage };

    if (tab === 'upload' && file) {
      onImport({ type: 'file', file }, options);
      return;
    }

    if (tab === 'library' && selectedAsset?.url) {
      onImport({ type: 'asset', asset: selectedAsset }, options);
    }
  }

  const canSubmit = tab === 'upload' ? !!file : !!selectedAsset?.url;

  if (!open) return null;

  return (
    <div className="stock-modal-overlay" onClick={() => !busy && onClose()}>
      <div className="stock-modal import-menu-modal" onClick={(e) => e.stopPropagation()}>
        <header className="stock-modal-header">
          <h2>Importar carta desde imagen</h2>
          <button type="button" className="close-btn" onClick={onClose} disabled={busy}>
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="import-menu-form">
          <p className="import-menu-hint">
            Usa una foto nítida y bien iluminada. Con idioma «Automático» el OCR combina catalán,
            castellano e inglés. Activa «Agrupar por títulos» para el patrón categoría → contenido.
          </p>

          <p className="import-menu-warning">
            Se reemplazará el contenido de la <strong>página {pageIndex + 1}</strong>.
          </p>

          <label className={`import-menu-field${busy ? ' is-disabled' : ''}`}>
            <span className="import-menu-field-label">Idioma de la carta</span>
            <select
              value={ocrLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={busy}
              aria-describedby="import-ocr-lang-hint"
            >
              {OCR_LANGUAGE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
            <small id="import-ocr-lang-hint">{selectedLangHint}</small>
          </label>

          <div className="import-menu-tabs" role="tablist" aria-label="Origen de la imagen">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'upload'}
              className={tab === 'upload' ? 'is-active' : undefined}
              disabled={busy}
              onClick={() => setTab('upload')}
            >
              Subir nueva
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'library'}
              className={tab === 'library' ? 'is-active' : undefined}
              disabled={busy}
              onClick={() => setTab('library')}
            >
              Mis archivos
            </button>
          </div>

          {tab === 'upload' && (
            <div className="import-menu-panel">
              <label className={`btn-file import-menu-file${busy ? ' btn-file--disabled' : ''}`}>
                {file ? 'Cambiar imagen' : 'Elegir imagen'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/*"
                  onChange={handleFileChange}
                  hidden
                  disabled={busy}
                />
              </label>

              {file && (
                <p className="import-menu-filename">
                  {file.name} ({Math.round(file.size / 1024)} KB)
                </p>
              )}

              {previewUrl && (
                <div className="import-menu-preview">
                  <img src={previewUrl} alt="Vista previa de la carta" />
                </div>
              )}
            </div>
          )}

          {tab === 'library' && (
            <div className="import-menu-panel">
              {assetsError && <div className="error-banner">{assetsError}</div>}
              {assetsLoading && <p className="import-menu-status">Cargando archivos…</p>}

              {!assetsLoading && assets.length === 0 && (
                <p className="import-menu-status">
                  No hay archivos subidos. Usa la pestaña «Subir nueva» o el gestor de Archivos.
                </p>
              )}

              {!assetsLoading && assets.length > 0 && (
                <ul className="import-menu-asset-grid">
                  {assets.map((asset) => {
                    const selected = asset.id === selectedAssetId;
                    return (
                      <li key={asset.id}>
                        <button
                          type="button"
                          className={`import-menu-asset-card${selected ? ' is-selected' : ''}`}
                          disabled={busy}
                          onClick={() => {
                            setSelectedAssetId(asset.id);
                            setFile(null);
                          }}
                          title={assetDisplayName(asset)}
                        >
                          {asset.url ? (
                            <img src={asset.url} alt="" loading="lazy" />
                          ) : (
                            <span>IMG</span>
                          )}
                          <span className="import-menu-asset-name">{assetDisplayName(asset)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {selectedAsset?.url && (
                <div className="import-menu-preview">
                  <img src={selectedAsset.url} alt="Vista previa del archivo seleccionado" />
                </div>
              )}
            </div>
          )}

          <label className={`import-menu-option${busy ? ' is-disabled' : ''}`}>
            <input
              type="checkbox"
              checked={groupByTitles}
              onChange={(e) => setGroupByTitles(e.target.checked)}
              disabled={busy}
            />
            <span>
              <strong>Agrupar texto por títulos</strong>
              <small>
                Una capa por categoría en mayúsculas (TAPES, BIKINIS…) y otra con el contenido
                debajo. Si hay dos columnas, las separa. Desactívalo para una capa por línea.
              </small>
            </span>
          </label>

          <ul className="import-menu-notes">
            <li>Funciona mejor con fotos nítidas y buena iluminación.</li>
            <li>Las fuentes decorativas y fondos recargados pueden dar posiciones aproximadas.</li>
            <li>Si eliges un archivo ya subido, no se vuelve a subir a R2.</li>
          </ul>

          <div className="import-menu-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={!canSubmit || busy}>
              {busy ? 'Importando…' : 'Analizar e importar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
