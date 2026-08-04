import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  MENU_OCR_PROMPT_EXTRA_MAX,
} from '@shared/menu-ocr';
import {
  DEFAULT_OCR_PROVIDER,
  MENU_OCR_PROVIDER_OPTIONS,
  parseOcrProviderChoice,
  type MenuOcrProviderChoice,
} from '@shared/ocr-providers';
import { ApiError, listAssets, type AssetSummary } from '@/lib/api';
import type { ImportMenuOptions } from '@/components/editor/ImportMenuModal';

export type MobileOcrImportSource =
  | { type: 'file'; file: File }
  | { type: 'asset'; asset: AssetSummary };

interface MobileImportOcrModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (sources: MobileOcrImportSource[], options: ImportMenuOptions) => void;
  busy?: boolean;
  progress?: { phase: string; percent: number; detail?: string } | null;
  /** Error de la última importación (el modal permanece abierto). */
  error?: string;
}

type SourceTab = 'upload' | 'library';

const OCR_PROVIDER_STORAGE_KEY = 'menubuilder.ocrProvider';
const MOBILE_OCR_EXTRA_HINT =
  'Prioriza platos con nombre y precio. Si hay ingredientes bajo el plato, inclúyelos. No hace falta detectar alérgenos. No omitas notas finales como IVA incluido o suplementos con %.';

function readStoredOcrProvider(): MenuOcrProviderChoice {
  try {
    return parseOcrProviderChoice(localStorage.getItem(OCR_PROVIDER_STORAGE_KEY));
  } catch {
    return DEFAULT_OCR_PROVIDER;
  }
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case 'prepare':
      return 'Preparando imagen';
    case 'ocr':
      return 'Leyendo carta con IA';
    case 'build':
      return 'Creando platos';
    case 'done':
      return 'Importación completada';
    default:
      return 'Procesando';
  }
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

function assetFileNameLower(asset: AssetSummary): string {
  return assetDisplayName(asset).toLowerCase();
}

/** Si el archivo ya está en la biblioteca (mismo nombre), reutiliza ese asset. */
export function matchAssetForFile(
  file: File,
  assets: AssetSummary[],
): AssetSummary | undefined {
  const name = file.name.trim().toLowerCase();
  if (!name) return undefined;
  return assets.find((asset) => {
    const assetName = assetFileNameLower(asset);
    return assetName === name || assetName.endsWith(`/${name}`) || asset.r2_key.toLowerCase().endsWith(`/${name}`);
  });
}

export function MobileImportOcrModal({
  open,
  onClose,
  onImport,
  busy = false,
  progress = null,
  error = '',
}: MobileImportOcrModalProps) {
  const [tab, setTab] = useState<SourceTab>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [provider, setProvider] = useState<MenuOcrProviderChoice>(readStoredOcrProvider);
  const [promptExtra, setPromptExtra] = useState(MOBILE_OCR_EXTRA_HINT);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);

  const previewUrls = useMemo(
    () => files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
    [files],
  );

  const selectedAssets = useMemo(
    () => assets.filter((a) => selectedAssetIds.includes(a.id) && !!a.url),
    [assets, selectedAssetIds],
  );

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
    return () => {
      for (const item of previewUrls) URL.revokeObjectURL(item.url);
    };
  }, [previewUrls]);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setTab('upload');
      setSelectedAssetIds([]);
      setAssetsError('');
      setReplaceExisting(false);
      setPromptExtra(MOBILE_OCR_EXTRA_HINT);
      setProvider(readStoredOcrProvider());
      return;
    }
    setProvider(readStoredOcrProvider());
    void loadAssets();
  }, [open, loadAssets]);

  useEffect(() => {
    if (!open) return;
    const prev = globalThis.document.body.style.overflow;
    globalThis.document.body.style.overflow = 'hidden';
    return () => {
      globalThis.document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  if (!open) return null;

  const providerHint =
    MENU_OCR_PROVIDER_OPTIONS.find((p) => p.id === provider)?.hint ?? '';

  const canSubmit =
    tab === 'upload' ? files.length > 0 : selectedAssets.length > 0;

  function handleFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    setFiles(list);
    setSelectedAssetIds([]);
    e.target.value = '';
  }

  function toggleAsset(id: string) {
    setSelectedAssetIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
    setFiles([]);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || !canSubmit) return;
    try {
      localStorage.setItem(OCR_PROVIDER_STORAGE_KEY, provider);
    } catch {
      /* ignore */
    }

    const options: ImportMenuOptions = {
      provider,
      promptExtra: promptExtra.trim().slice(0, MENU_OCR_PROMPT_EXTRA_MAX) || undefined,
      replaceExisting,
    };

    if (tab === 'library') {
      onImport(
        selectedAssets.map((asset) => ({ type: 'asset' as const, asset })),
        options,
      );
      return;
    }

    // Subir nueva: si el archivo ya existe en la biblioteca, reutilizar el asset.
    const sources: MobileOcrImportSource[] = files.map((file) => {
      const existing = matchAssetForFile(file, assets);
      if (existing?.url) return { type: 'asset', asset: existing };
      return { type: 'file', file };
    });
    onImport(sources, options);
  }

  const modal = (
    <div
      className={`stock-modal-overlay stock-modal-overlay--blocking mobile-ocr-modal-overlay${busy ? ' is-busy' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-busy={busy || undefined}
      aria-labelledby={busy ? 'mobile-ocr-busy-title' : 'mobile-ocr-title'}
    >
      <div
        className="stock-modal import-menu-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="stock-modal-header">
          <h2 id={busy ? 'mobile-ocr-busy-title' : 'mobile-ocr-title'}>
            {busy ? 'Importando carta…' : 'Importar carta con IA'}
          </h2>
        </div>

        {busy ? (
          <div className="import-menu-busy">
            <p className="import-menu-busy-phase">
              {phaseLabel(progress?.phase ?? 'ocr')}
              {progress?.detail ? ` · ${progress.detail}` : ''}
            </p>
            <div className="upload-progress-track import-menu-busy-track">
              <div
                className="upload-progress-bar"
                style={{ width: `${Math.max(0, Math.min(100, progress?.percent ?? 0))}%` }}
              />
            </div>
            <p className="import-menu-busy-percent">{progress?.percent ?? 0}%</p>
            <p className="import-menu-busy-hint">
              La IA está trabajando. No cierres esta ventana hasta que termine.
            </p>
          </div>
        ) : (
          <form className="import-menu-form" onSubmit={handleSubmit}>
            {error && <div className="error-banner">{error}</div>}

            <p className="import-menu-hint">
              Sube una o varias fotos de la carta, o elige archivos ya subidos. Se detectarán
              secciones, platos, precios e ingredientes (si aparecen). Los alérgenos no se rellenan.
            </p>

            <label className="import-menu-field">
              <span className="import-menu-field-label">Motor de reconocimiento</span>
              <select
                value={provider}
                onChange={(e) => setProvider(parseOcrProviderChoice(e.target.value))}
              >
                {MENU_OCR_PROVIDER_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {providerHint && <small>{providerHint}</small>}
            </label>

            <label className="import-menu-field">
              <span className="import-menu-field-label">
                Indicaciones extra <span className="import-menu-optional">(opcional)</span>
              </span>
              <textarea
                rows={3}
                value={promptExtra}
                onChange={(e) =>
                  setPromptExtra(e.target.value.slice(0, MENU_OCR_PROMPT_EXTRA_MAX))
                }
                maxLength={MENU_OCR_PROMPT_EXTRA_MAX}
              />
            </label>
            <label className="mobile-props-checkbox">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
              />
              <span className="mobile-props-checkbox-label">
                Limpiar lienzo antes de importar (reemplazar contenido actual)
              </span>
            </label>

            <div className="import-menu-tabs" role="tablist" aria-label="Origen de la imagen">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'upload'}
                className={tab === 'upload' ? 'is-active' : undefined}
                onClick={() => setTab('upload')}
              >
                Subir nueva
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'library'}
                className={tab === 'library' ? 'is-active' : undefined}
                onClick={() => {
                  setTab('library');
                  void loadAssets();
                }}
              >
                Mis archivos
              </button>
            </div>

            {tab === 'upload' && (
              <div className="import-menu-panel">
                <label className="btn-file import-menu-file">
                  {files.length > 0 ? 'Cambiar imágenes' : 'Elegir imágenes'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/*"
                    multiple
                    onChange={handleFilesChange}
                    hidden
                  />
                </label>
                {files.length > 0 && (
                  <p className="import-menu-filename">
                    {files.length} imagen{files.length === 1 ? '' : 'es'} seleccionada
                    {files.length === 1 ? '' : 's'}
                    {files.some((f) => matchAssetForFile(f, assets))
                      ? ' · algunas ya están en tu biblioteca (no se volverán a subir)'
                      : ''}
                  </p>
                )}
                {previewUrls.length > 0 && (
                  <ul className="import-menu-asset-grid mobile-ocr-preview-grid">
                    {previewUrls.map((item) => (
                      <li key={item.url}>
                        <div className="import-menu-asset-card">
                          <img src={item.url} alt={item.name} />
                          <span className="import-menu-asset-name">{item.name}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
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
                      const selected = selectedAssetIds.includes(asset.id);
                      return (
                        <li key={asset.id}>
                          <button
                            type="button"
                            className={`import-menu-asset-card${selected ? ' is-selected' : ''}`}
                            onClick={() => toggleAsset(asset.id)}
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
                {selectedAssets.length > 0 && (
                  <p className="import-menu-filename">
                    {selectedAssets.length} archivo{selectedAssets.length === 1 ? '' : 's'} de la
                    biblioteca
                  </p>
                )}
              </div>
            )}

            <ul className="import-menu-notes">
              <li>
                Si activas «Limpiar lienzo», se reemplaza todo el contenido actual por lo reconocido.
              </li>
              <li>
                Si lo dejas desactivado, los componentes reconocidos se añaden al final de la carta.
              </li>
              <li>Los archivos ya subidos se reutilizan; no se vuelven a subir a la biblioteca.</li>
            </ul>

            <div className="import-menu-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={!canSubmit}>
                Importar con IA
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(modal, globalThis.document.body);
}
