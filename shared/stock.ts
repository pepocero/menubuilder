export type StockProvider = 'pixabay' | 'pexels';

export interface StockImage {
  id: string;
  provider: StockProvider;
  previewUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  alt?: string;
}

export interface StockSearchResult {
  images: StockImage[];
  total: number;
  page: number;
  perPage: number;
}

export interface StockSearchOptions {
  query: string;
  page?: number;
  perPage?: number;
}
