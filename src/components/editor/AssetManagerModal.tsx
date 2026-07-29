import { useCallback, useEffect, useState } from 'react';
import { ApiError, deleteAsset, listAssets, type AssetSummary } from '@/lib/api';
import { appConfirm } from '@/lib/app-dialog';

interface AssetManagerModalProps {
  open: boolean;
  onClose: () => void;
  menuId?: string;
  /** Coloca un archivo ya subido en la página activa del editor */
  onUseOnPage: (asset: AssetSummary) => void | Promise<void>;
  /** Tras borrar en R2/D1: quitar la imagen del documento abierto si aplica */
  onAssetDeleted: (asset: { id: string; url: string | null }) => void;
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

function formatDate(value: string): string {
  const date = new Date(value.includes('T') ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sourceLabel(source: string | null): string {
  if (source === 'stock') return 'Stock';
  if (source === 'upload') return 'Subida';
  return source?.trim() || 'Archivo';
}

export function AssetManagerModal({
  open,
  onClose,
  menuId,
  onUseOnPage,
  onAssetDeleted,
}: AssetManagerModalProps) {
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [placingId, setPlacingId] = useState<string | null>(null);

  const busy = loading || !!deletingId || !!placingId;

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listAssets();
      setAssets(result.assets);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los archivos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadAssets();
      setPlacingId(null);
    }
  }, [open, loadAssets]);

  async function handleUseOnPage(asset: AssetSummary) {
    if (!asset.url || busy) return;
    setPlacingId(asset.id);
    setError('');
    try {
      await onUseOnPage(asset);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo añadir la imagen a la página',
      );
    } finally {
      setPlacingId(null);
    }
  }

  async function handleDelete(asset: AssetSummary) {
    const name = assetDisplayName(asset);
    const confirmed = await appConfirm(
      `¿Eliminar «${name}»?\n\nSe borrará de tu almacenamiento (R2) y de la base de datos. Si está en algún menú, la imagen dejará de mostrarse.`,
      {
        title: 'Eliminar archivo',
        variant: 'danger',
        confirmText: 'Eliminar',
      },
    );
    if (!confirmed) return;

    setDeletingId(asset.id);
    setError('');
    try {
      const result = await deleteAsset({
        id: asset.id,
        url: asset.url ?? undefined,
        exclude_menu_id: menuId,
        force: true,
      });

      if (!result.deleted) {
        setError(result.reason ?? 'No se pudo eliminar el archivo');
        return;
      }

      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      onAssetDeleted({ id: asset.id, url: asset.url ?? result.url ?? null });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el archivo');
    } finally {
      setDeletingId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="stock-modal-overlay" onClick={() => !busy && onClose()}>
      <div className="stock-modal asset-manager-modal" onClick={(e) => e.stopPropagation()}>
        <header className="stock-modal-header">
          <h2>Mis archivos</h2>
          <button type="button" className="close-btn" onClick={onClose} disabled={busy}>
            ✕
          </button>
        </header>

        <div className="asset-manager-body">
          <p className="asset-manager-hint">
            Archivos de imagen de tu cuenta. Usa «Añadir a la página» para colocar uno en la página
            activa del editor sin volver a subirlo. Al eliminarlos se quitan de R2 y de la base de
            datos.
          </p>

          {error && <div className="error-banner">{error}</div>}

          {loading && <p className="asset-manager-status">Cargando archivos…</p>}

          {!loading && assets.length === 0 && (
            <p className="asset-manager-status">No tienes archivos subidos todavía.</p>
          )}

          {!loading && assets.length > 0 && (
            <ul className="asset-manager-list">
              {assets.map((asset) => {
                const isPlacing = placingId === asset.id;
                const canUse = !!asset.url;
                return (
                  <li key={asset.id} className="asset-manager-item">
                    <div className="asset-manager-thumb">
                      {asset.url ? (
                        <img src={asset.url} alt="" loading="lazy" />
                      ) : (
                        <span className="asset-manager-thumb-fallback">IMG</span>
                      )}
                    </div>
                    <div className="asset-manager-meta">
                      <strong className="asset-manager-name" title={assetDisplayName(asset)}>
                        {assetDisplayName(asset)}
                      </strong>
                      <span className="asset-manager-sub">
                        {sourceLabel(asset.source)} · {formatDate(asset.created_at)}
                      </span>
                    </div>
                    <div className="asset-manager-actions">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!canUse || busy}
                        title={
                          canUse
                            ? 'Colocar esta imagen en la página activa'
                            : 'Este archivo no tiene URL disponible'
                        }
                        onClick={() => void handleUseOnPage(asset)}
                      >
                        {isPlacing ? 'Añadiendo…' : 'Añadir a la página'}
                      </button>
                      <button
                        type="button"
                        className="btn-danger-outline"
                        disabled={busy}
                        onClick={() => void handleDelete(asset)}
                      >
                        {deletingId === asset.id ? 'Eliminando…' : 'Eliminar'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="asset-manager-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void loadAssets()}
            disabled={busy}
          >
            Actualizar
          </button>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
