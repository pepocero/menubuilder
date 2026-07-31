import { createAsset } from '../../lib/db';
import {
  buildR2Key,
  fetchRemoteImageFromCandidates,
  getAssetPublicUrl,
  uploadToR2,
} from '../../lib/r2';
import { fetchPixabayHitById, pixabayDownloadCandidates } from '../../lib/stock/pixabay';
import { errorResponse, jsonResponse, parseJson } from '../../lib/types';

interface ImportStockBody {
  provider?: string;
  stockImageId?: string;
  fullUrl?: string;
  /** URLs alternativas (CDN Pixabay a varios tamaños, etc.) */
  fallbackUrls?: string[];
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const userId = context.data.userId as string;
  const body = await parseJson<ImportStockBody>(request);

  if (!body?.stockImageId) {
    return errorResponse('stockImageId requerido');
  }

  const candidates: string[] = [];
  if (body.fullUrl) candidates.push(body.fullUrl);
  for (const url of body.fallbackUrls ?? []) {
    if (url) candidates.push(url);
  }

  // Pixabay: pedir hit fresco por id (URLs get/ nuevas) + candidatos CDN
  const provider = (body.provider ?? 'pixabay').toLowerCase();
  if (provider === 'pixabay' && env.PIXABAY_API_KEY) {
    try {
      const hit = await fetchPixabayHitById(env.PIXABAY_API_KEY, body.stockImageId);
      if (hit) {
        candidates.unshift(...pixabayDownloadCandidates(hit));
      }
    } catch (err) {
      console.error('Pixabay refresh by id falló', body.stockImageId, err);
    }
  }

  if (candidates.length === 0) {
    return errorResponse('fullUrl o fallbackUrls requeridos');
  }

  const remote = await fetchRemoteImageFromCandidates(candidates);
  if (!remote) {
    return errorResponse(
      'No se pudo descargar la imagen de stock al servidor. Prueba otra foto o súbela desde tu dispositivo.',
      422,
    );
  }

  const ext = remote.contentType.split('/')[1] ?? 'jpg';
  const r2Key = buildR2Key(userId, `stock-${body.stockImageId}.${ext}`);

  await uploadToR2(env.MEDIA, r2Key, remote.buffer, remote.contentType);
  const url = getAssetPublicUrl(request, r2Key);
  const assetId = crypto.randomUUID();

  await createAsset(env.DB, assetId, userId, 'image', r2Key, url, 'stock');

  return jsonResponse({ asset: { id: assetId, url, r2_key: r2Key } }, 201);
};
