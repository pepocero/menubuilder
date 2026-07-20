import type { StockSearchResult } from '@shared/stock';
import { api } from './api';

export async function searchStockImages(
  query: string,
  page = 1,
  perPage = 20,
): Promise<StockSearchResult> {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    per_page: String(perPage),
  });
  return api.get(`/api/stock/search?${params.toString()}`);
}
