import type { StockImage, StockSearchOptions, StockSearchResult } from '../../../shared/stock';
import type { StockImageProvider } from './types';

interface PexelsPhoto {
  id: number;
  alt: string;
  width: number;
  height: number;
  src: {
    medium: string;
    large: string;
    original: string;
  };
}

interface PexelsResponse {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
}

export class PexelsProvider implements StockImageProvider {
  readonly name = 'pexels' as const;

  constructor(private apiKey: string) {}

  async search(options: StockSearchOptions): Promise<StockSearchResult> {
    const page = options.page ?? 1;
    const perPage = Math.min(options.perPage ?? 20, 50);
    const params = new URLSearchParams({
      query: options.query,
      page: String(page),
      per_page: String(perPage),
    });

    const response = await fetch(`https://api.pexels.com/v1/search?${params.toString()}`, {
      headers: { Authorization: this.apiKey },
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Límite de búsqueda alcanzado. Inténtalo más tarde.');
      }
      throw new Error('Error al buscar imágenes en Pexels');
    }

    const data = (await response.json()) as PexelsResponse;
    const images: StockImage[] = data.photos.map((photo) => ({
      id: String(photo.id),
      provider: 'pexels',
      previewUrl: photo.src.medium,
      fullUrl: photo.src.large || photo.src.original,
      width: photo.width,
      height: photo.height,
      alt: photo.alt,
    }));

    return {
      images,
      total: data.total_results,
      page: data.page,
      perPage: data.per_page,
    };
  }
}
