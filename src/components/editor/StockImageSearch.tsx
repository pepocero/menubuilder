import { useCallback, useState } from 'react';
import type { StockImage } from '@shared/stock';
import { searchStockImages } from '@/lib/stock';

interface StockImageSearchProps {
  open: boolean;
  onClose: () => void;
  onSelect: (image: StockImage) => void;
  busy?: boolean;
}

export function StockImageSearch({ open, onClose, onSelect, busy = false }: StockImageSearchProps) {
  const [query, setQuery] = useState('');
  const [images, setImages] = useState<StockImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const handleSearch = useCallback(async (searchQuery: string, searchPage = 1) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await searchStockImages(searchQuery, searchPage);
      setImages(searchPage === 1 ? result.images : (prev) => [...prev, ...result.images]);
      setTotal(result.total);
      setPage(searchPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en la búsqueda');
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSearch(query, 1);
  }

  if (!open) return null;

  return (
    <div className="stock-modal-overlay" onClick={() => !busy && onClose()}>
      <div className="stock-modal" onClick={(e) => e.stopPropagation()}>
        <header className="stock-modal-header">
          <h2>Imágenes de stock</h2>
          <button type="button" className="close-btn" onClick={onClose} disabled={busy}>
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="stock-search-form">
          <input
            type="search"
            placeholder="Buscar imágenes (ej: pasta, coffee, restaurant)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={busy}
          />
          <button type="submit" className="btn-primary" disabled={loading || busy}>
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </form>

        {busy && <div className="stock-busy">Añadiendo imagen al lienzo...</div>}
        {error && <div className="error-banner">{error}</div>}

        <div className="stock-grid">
          {images.map((image) => (
            <button
              key={`${image.provider}-${image.id}`}
              type="button"
              className="stock-item"
              disabled={busy}
              onClick={() => onSelect(image)}
            >
              <img src={image.previewUrl} alt={image.alt ?? 'Stock image'} loading="lazy" />
            </button>
          ))}
        </div>

        {images.length < total && (
          <button
            type="button"
            className="btn-secondary load-more"
            disabled={loading || busy}
            onClick={() => handleSearch(query, page + 1)}
          >
            Cargar más
          </button>
        )}
      </div>
    </div>
  );
}
