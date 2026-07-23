import { useCallback, useEffect, useState } from 'react';
import { ApiError, listAssets, type AssetSummary } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  MENU_OCR_PROMPT_EXTRA_MAX,
  MENU_OCR_SYSTEM_PROMPT,
  MENU_OCR_USER_PROMPT,
} from '@shared/menu-ocr';
import {
  DEFAULT_OCR_PROVIDER,
  MENU_OCR_PROVIDER_OPTIONS,
  parseOcrProviderChoice,
  type MenuOcrProviderChoice,
} from '@shared/ocr-providers';

export type ImportMenuSource =
  | { type: 'file'; file: File }
  | { type: 'asset'; asset: AssetSummary };

export interface ImportMenuOptions {
  provider: MenuOcrProviderChoice;
  /** Apéndice opcional al prompt de OCR (mismo para todos los motores). */
  promptExtra?: string;
}

interface ImportMenuModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (source: ImportMenuSource, options: ImportMenuOptions) => void;
  busy?: boolean;
  /** Progreso 0–100 mientras busy (OCR / subida / capas). */
  progress?: { phase: string; percent: number } | null;
  pageIndex: number;
}

function importPhaseLabel(phase: string): string {
  switch (phase) {
    case 'compress':
      return 'Comprimiendo imagen';
    case 'upload':
      return 'Subiendo archivo';
    case 'ocr':
      return 'Leyendo carta con IA';
    case 'import':
      return 'Creando capas en el lienzo';
    case 'place':
      return 'Colocando en el lienzo';
    default:
      return 'Procesando';
  }
}

type SourceTab = 'upload' | 'library';

const OCR_PROVIDER_STORAGE_KEY = 'menubuilder.ocrProvider';

function readStoredOcrProvider(): MenuOcrProviderChoice {
  try {
    return parseOcrProviderChoice(localStorage.getItem(OCR_PROVIDER_STORAGE_KEY));
  } catch {
    return DEFAULT_OCR_PROVIDER;
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

/** Icono tipo reproductor: entrar a pantalla completa. */
function IconExpandFullscreen() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 3H4v4M16 3h4v4M8 21H4v-4M16 21h4v-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Icono tipo reproductor: salir de pantalla completa. */
function IconCollapseFullscreen() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 3v4H5M15 3v4h4M9 21v-4H5M15 21v-4h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ImportImagePreview({
  src,
  alt,
  disabled = false,
}: {
  src: string;
  alt: string;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setExpanded(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded]);

  useEffect(() => {
    if (disabled) setExpanded(false);
  }, [disabled]);

  useEffect(() => {
    setExpanded(false);
  }, [src]);

  return (
    <>
      <div className="import-menu-preview">
        <button
          type="button"
          className="import-menu-preview-hit"
          disabled={disabled}
          onClick={() => setExpanded(true)}
          aria-label="Ampliar vista previa"
          title="Ampliar"
        >
          <img src={src} alt={alt} />
        </button>
        <button
          type="button"
          className="import-menu-preview-fs-btn"
          disabled={disabled}
          onClick={() => setExpanded(true)}
          aria-label="Ampliar a pantalla completa"
          title="Ampliar"
        >
          <IconExpandFullscreen />
        </button>
      </div>

      {expanded && (
        <div
          className="import-menu-preview-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa ampliada"
          onClick={() => setExpanded(false)}
        >
          <div
            className="import-menu-preview-lightbox-inner"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={src} alt={alt} />
            <button
              type="button"
              className="import-menu-preview-fs-btn import-menu-preview-fs-btn--lightbox"
              onClick={() => setExpanded(false)}
              aria-label="Cerrar pantalla completa"
              title="Cerrar"
            >
              <IconCollapseFullscreen />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function ImportMenuModal({
  open,
  onClose,
  onImport,
  busy = false,
  progress = null,
  pageIndex,
}: ImportMenuModalProps) {
  const { isSystemAdmin } = useAuth();
  const [tab, setTab] = useState<SourceTab>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [provider, setProvider] = useState<MenuOcrProviderChoice>(DEFAULT_OCR_PROVIDER);
  const [promptExtra, setPromptExtra] = useState('');
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? null;
  const selectedProviderHint =
    MENU_OCR_PROVIDER_OPTIONS.find((p) => p.id === provider)?.hint ?? '';

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
      setTab('upload');
      setSelectedAssetId(null);
      setAssetsError('');
      setPromptExtra('');
      return;
    }
    setProvider(readStoredOcrProvider());
  }, [open]);

  useEffect(() => {
    if (open && tab === 'library') {
      void loadAssets();
    }
  }, [open, tab, loadAssets]);

  function handleProviderChange(value: string) {
    const next = parseOcrProviderChoice(value);
    setProvider(next);
    try {
      localStorage.setItem(OCR_PROVIDER_STORAGE_KEY, next);
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

    const trimmedExtra = promptExtra.trim().slice(0, MENU_OCR_PROMPT_EXTRA_MAX);
    const options: ImportMenuOptions = {
      provider,
      ...(trimmedExtra ? { promptExtra: trimmedExtra } : {}),
    };

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
    <div
      className={`stock-modal-overlay${busy ? ' stock-modal-overlay--blocking' : ''}`}
      onClick={() => !busy && onClose()}
      role={busy ? 'alertdialog' : undefined}
      aria-modal={busy ? true : undefined}
      aria-busy={busy || undefined}
      aria-labelledby={busy ? 'import-menu-busy-title' : undefined}
    >
      <div className="stock-modal import-menu-modal" onClick={(e) => e.stopPropagation()}>
        <header className="stock-modal-header">
          <h2 id={busy ? 'import-menu-busy-title' : undefined}>
            {busy ? 'Importando carta…' : 'Importar carta desde imagen'}
          </h2>
          <button type="button" className="close-btn" onClick={onClose} disabled={busy}>
            ✕
          </button>
        </header>

        {busy && (
          <div className="import-menu-busy">
            <p className="import-menu-busy-phase">
              {importPhaseLabel(progress?.phase ?? 'ocr')}
            </p>
            <div className="upload-progress-track import-menu-busy-track">
              <div
                className="upload-progress-bar"
                style={{
                  width: `${Math.max(0, Math.min(100, progress?.percent ?? 0))}%`,
                }}
              />
            </div>
            <p className="import-menu-busy-percent">{progress?.percent ?? 0}%</p>
            <p className="import-menu-busy-hint">
              La IA está trabajando. No cierres esta ventana ni edites el menú hasta que termine.
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className={`import-menu-form${busy ? ' import-menu-form--busy' : ''}`}
          inert={busy}
        >
          <p className="import-menu-hint">
            El reconocimiento usa visión por IA: lee columnas, secciones y precios. Elige el motor
            antes de analizar.
          </p>

          <p className="import-menu-warning">
            Se reemplazará el contenido de la <strong>página {pageIndex + 1}</strong>.
          </p>

          <label className={`import-menu-field${busy ? ' is-disabled' : ''}`}>
            <span className="import-menu-field-label">Motor de reconocimiento</span>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              disabled={busy}
              aria-describedby="import-ocr-provider-hint"
            >
              {MENU_OCR_PROVIDER_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <small id="import-ocr-provider-hint">{selectedProviderHint}</small>
          </label>

          {isSystemAdmin && (
            <>
              <label className={`import-menu-field${busy ? ' is-disabled' : ''}`}>
                <span className="import-menu-field-label">
                  Indicaciones extra <span className="import-menu-optional">(opcional)</span>
                </span>
                <textarea
                  value={promptExtra}
                  onChange={(e) =>
                    setPromptExtra(e.target.value.slice(0, MENU_OCR_PROMPT_EXTRA_MAX))
                  }
                  disabled={busy}
                  rows={3}
                  maxLength={MENU_OCR_PROMPT_EXTRA_MAX}
                  placeholder="Ej.: Incluye AMANIDES y ENTREPANS; hay 2 columnas; no omitas la derecha…"
                  aria-describedby="import-ocr-extra-hint"
                />
                <small id="import-ocr-extra-hint">
                  Se añaden al prompt base (mismo para todos los motores). {promptExtra.length}/
                  {MENU_OCR_PROMPT_EXTRA_MAX}
                </small>
              </label>

              <details className="import-menu-prompt-details">
                <summary>Ver instrucciones base de la IA</summary>
                <p className="import-menu-prompt-note">
                  System y user son comunes a Workers AI y OpenAI. Tus indicaciones extra se añaden
                  al mensaje de usuario.
                </p>
                <h3>System</h3>
                <pre className="import-menu-prompt-pre">{MENU_OCR_SYSTEM_PROMPT}</pre>
                <h3>User</h3>
                <pre className="import-menu-prompt-pre">{MENU_OCR_USER_PROMPT}</pre>
              </details>
            </>
          )}

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
                <ImportImagePreview
                  src={previewUrl}
                  alt="Vista previa de la carta"
                  disabled={busy}
                />
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
                <ImportImagePreview
                  src={selectedAsset.url}
                  alt="Vista previa del archivo seleccionado"
                  disabled={busy}
                />
              )}
            </div>
          )}

          <ul className="import-menu-notes">
            <li>Funciona mejor con fotos nítidas y buena iluminación.</li>
            <li>Tras importar, revisa precios y capas antes de guardar.</li>
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
