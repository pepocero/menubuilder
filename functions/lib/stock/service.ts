import type { StockSearchOptions, StockSearchResult } from '../../../shared/stock';
import type { Env } from '../types';
import { PexelsProvider } from './pexels';
import { PixabayProvider } from './pixabay';
import type { StockImageProvider } from './types';

export function getActiveProvider(env: Env): StockImageProvider {
  const provider = (env.STOCK_PROVIDER ?? 'pixabay').toLowerCase();

  if (provider === 'pexels') {
    if (!env.PEXELS_API_KEY) {
      throw new Error('PEXELS_API_KEY no configurada');
    }
    return new PexelsProvider(env.PEXELS_API_KEY);
  }

  if (!env.PIXABAY_API_KEY) {
    throw new Error('PIXABAY_API_KEY no configurada');
  }
  return new PixabayProvider(env.PIXABAY_API_KEY);
}

export async function searchStockImages(
  env: Env,
  options: StockSearchOptions,
): Promise<StockSearchResult> {
  if (!options.query?.trim()) {
    return { images: [], total: 0, page: options.page ?? 1, perPage: options.perPage ?? 20 };
  }

  const provider = getActiveProvider(env);
  return provider.search({
    query: options.query.trim(),
    page: options.page ?? 1,
    perPage: options.perPage ?? 20,
  });
}
