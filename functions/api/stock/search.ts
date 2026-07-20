import { searchStockImages } from '../../lib/stock/service';
import { errorResponse, jsonResponse } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const query = url.searchParams.get('q') ?? '';
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const perPage = parseInt(url.searchParams.get('per_page') ?? '20', 10);

  try {
    const result = await searchStockImages(context.env, {
      query,
      page: Number.isNaN(page) ? 1 : page,
      perPage: Number.isNaN(perPage) ? 20 : perPage,
    });
    return jsonResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error en búsqueda de stock';
    return errorResponse(message, 502);
  }
};
