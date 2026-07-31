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

/**
 * `pixabay.com/get/...` caduca (~24h) y muchos fetches server-side reciben 400.
 * Las URLs `cdn.pixabay.com/photo/...?_1280` son más estables para descargar a R2.
 */
export function pixabayDownloadCandidates(hit: {
  previewURL: string;
  webformatURL?: string;
  largeImageURL?: string;
}): string[] {
  const urls: string[] = [];
  const preview = hit.previewURL ?? '';
  if (preview.includes('cdn.pixabay.com')) {
    for (const size of ['_1280', '_960', '_640', '_180'] as const) {
      const next = preview.replace(/_150\.(jpe?g|png|webp)$/i, `${size}.$1`);
      if (next !== preview) urls.push(next);
    }
    urls.push(preview);
  }
  if (hit.largeImageURL) urls.push(hit.largeImageURL);
  if (hit.webformatURL) urls.push(hit.webformatURL);
  return [...new Set(urls.filter(Boolean))];
}

export async function fetchPixabayHitById(
  apiKey: string,
  imageId: string,
): Promise<PixabayHit | null> {
  const params = new URLSearchParams({
    key: apiKey,
    id: imageId,
  });
  const response = await fetch(`https://pixabay.com/api/?${params.toString()}`);
  if (!response.ok) return null;
  const data = (await response.json()) as PixabayResponse;
  return data.hits?.[0] ?? null;
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
    const images: StockImage[] = data.hits.map((hit) => {
      const candidates = pixabayDownloadCandidates(hit);
      return {
        id: String(hit.id),
        provider: 'pixabay' as const,
        previewUrl: hit.previewURL,
        fullUrl: candidates[0] ?? hit.largeImageURL ?? hit.webformatURL,
        downloadUrls: candidates,
        width: hit.imageWidth,
        height: hit.imageHeight,
        alt: hit.tags,
      };
    });

    return {
      images,
      total: data.totalHits,
      page,
      perPage,
    };
  }
}
