import type { StockSearchOptions, StockSearchResult } from '../../shared/stock';

export interface StockImageProvider {
  readonly name: 'pixabay' | 'pexels';
  search(options: StockSearchOptions): Promise<StockSearchResult>;
}
