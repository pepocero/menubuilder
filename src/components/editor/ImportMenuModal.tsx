import { useCallback, useEffect, useState } from 'react';
import { ApiError, listAssets, type AssetSummary } from '@/lib/api';

export type ImportMenuSource =
  | { type: 'file'; file: File }
  | { type: 'asset'; asset: AssetSummary };

interface ImportMenuModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (source: ImportMenuSource) => void;
  busy?: boolean;
  pageIndex: number;
}

type SourceTab = 'upload' | 'library';

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
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? null;

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
    }
  }, [open]);

  useEffect(() => {
    if (open && tab === 'library') {
      void loadAssets();
    }
  }, [open, tab, loadAssets]);

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

    if (tab === 'upload' && file) {
      onImport({ type: 'file', file });
      return;
    }

    if (tab === 'library' && selectedAsset?.url) {
      onImport({ type: 'asset', asset: selectedAsset });
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
            El reconocimiento usa visión por IA (calidad similar a ChatGPT): lee columnas,
            secciones y precios sin mezclar el texto.
          </p>

          <p className="import-menu-warning">
            Se reemplazará el contenido de la <strong>página {pageIndex + 1}</strong>.
          </p>

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
