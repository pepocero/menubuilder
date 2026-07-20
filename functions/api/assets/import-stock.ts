import { createAsset } from '../../lib/db';
import {
  buildR2Key,
  fetchRemoteImage,
  getAssetPublicUrl,
  uploadToR2,
} from '../../lib/r2';
import { errorResponse, jsonResponse, parseJson } from '../../lib/types';

interface ImportStockBody {
  provider?: string;
  stockImageId?: string;
  fullUrl?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const userId = context.data.userId as string;
  const body = await parseJson<ImportStockBody>(request);

  if (!body?.fullUrl || !body?.stockImageId) {
    return errorResponse('fullUrl y stockImageId requeridos');
  }

  const remote = await fetchRemoteImage(body.fullUrl);
  if (!remote) {
    return errorResponse('No se pudo descargar la imagen', 422);
  }

  const ext = remote.contentType.split('/')[1] ?? 'jpg';
  const r2Key = buildR2Key(userId, `stock-${body.stockImageId}.${ext}`);

  await uploadToR2(env.MEDIA, r2Key, remote.buffer, remote.contentType);
  const url = getAssetPublicUrl(request, r2Key);
  const assetId = crypto.randomUUID();

  await createAsset(env.DB, assetId, userId, 'image', r2Key, url, 'stock');

  return jsonResponse({ asset: { id: assetId, url, r2_key: r2Key } }, 201);
};
