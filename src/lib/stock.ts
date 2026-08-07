import type { StockImage, StockSearchResult } from '@shared/stock';
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

/** Palabras vacías (ES/EN) que no aportan al match con tags de stock. */
const STOCK_QUERY_STOPWORDS = new Set([
  'a',
  'al',
  'con',
  'de',
  'del',
  'el',
  'en',
  'la',
  'las',
  'los',
  'o',
  'para',
  'por',
  'un',
  'una',
  'unos',
  'unas',
  'y',
  'and',
  'of',
  'the',
  'with',
  'in',
  'on',
  'for',
  'to',
]);

/**
 * Limpia el nombre del plato y lo orienta a stock gastronómico (inglés).
 * Quita precios, símbolos y ruido; añade "food" para sesgar resultados.
 */
export function buildDishStockSearchQuery(dishTitle: string): string {
  let cleaned = dishTitle
    .normalize('NFKC')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]/g, ' ')
    .replace(/€|\$|£|¥/g, ' ')
    .replace(/\b\d+([.,]\d+)?\s*(€|eur|euros?|usd|\$)?\b/gi, ' ')
    .replace(/[|/·•]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  // Limitar longitud: demasiadas palabras diluyen la búsqueda en Pixabay/Pexels.
  const words = cleaned.split(' ').filter(Boolean).slice(0, 6);
  cleaned = words.join(' ');

  const lower = cleaned.toLowerCase();
  if (!/\b(food|dish|meal|comida|plato)\b/i.test(lower)) {
    cleaned = `${cleaned} food`;
  }
  return cleaned;
}

function tokenizeForStockMatch(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOCK_QUERY_STOPWORDS.has(w));
}

/**
 * Puntúa una imagen de stock según solapamiento del nombre del plato
 * con `alt`/tags. Empates: se mantiene el orden del proveedor (más relevante).
 */
export function scoreStockImageForDish(dishTitle: string, image: StockImage): number {
  const dishTokens = tokenizeForStockMatch(dishTitle);
  if (dishTokens.length === 0) return 0;

  const haystack = (image.alt ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (!haystack) return 0;

  let score = 0;
  for (const token of dishTokens) {
    if (haystack.includes(token)) {
      // Tokens más largos suelen ser más discriminativos (paella > pan).
      score += 2 + Math.min(3, token.length - 3);
    }
  }

  const phrase = dishTokens.join(' ');
  if (phrase.length >= 5 && haystack.includes(phrase)) {
    score += 8;
  }

  return score;
}

/** Elige la imagen cuyos tags mejor encajan con el plato; desempate = orden del API. */
export function pickBestStockImageForDish(
  dishTitle: string,
  images: readonly StockImage[],
): StockImage | null {
  if (!images.length) return null;

  let best = images[0]!;
  let bestScore = scoreStockImageForDish(dishTitle, best);
  for (let i = 1; i < images.length; i++) {
    const image = images[i]!;
    const score = scoreStockImageForDish(dishTitle, image);
    if (score > bestScore) {
      best = image;
      bestScore = score;
    }
  }
  return best;
}
