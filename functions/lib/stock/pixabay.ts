import type { StockImage, StockSearchOptions, StockSearchResult } from '../../../shared/stock';
import type { StockImageProvider } from './types';

interface PixabayHit {
  id: number;
  tags: string;
  previewURL: string;
  webformatURL: string;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
}

interface PixabayResponse {
  total: number;
  totalHits: number;
  hits: PixabayHit[];
}

export class PixabayProvider implements StockImageProvider {
  readonly name = 'pixabay' as const;

  constructor(private apiKey: string) {}

  async search(options: StockSearchOptions): Promise<StockSearchResult> {
    const page = options.page ?? 1;
    const perPage = Math.min(options.perPage ?? 20, 50);
    const params = new URLSearchParams({
      key: this.apiKey,
      q: options.query,
      image_type: 'photo',
      orientation: 'all',
      safesearch: 'true',
      page: String(page),
      per_page: String(perPage),
    });

    const response = await fetch(`https://pixabay.com/api/?${params.toString()}`);
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Límite de búsqueda alcanzado. Inténtalo más tarde.');
      }
      throw new Error('Error al buscar imágenes en Pixabay');
    }

    const data = (await response.json()) as PixabayResponse;
    const images: StockImage[] = data.hits.map((hit) => ({
      id: String(hit.id),
      provider: 'pixabay',
      previewUrl: hit.previewURL,
      fullUrl: hit.largeImageURL || hit.webformatURL,
      width: hit.imageWidth,
      height: hit.imageHeight,
      alt: hit.tags,
    }));

    return {
      images,
      total: data.totalHits,
      page,
      perPage,
    };
  }
}
