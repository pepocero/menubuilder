import {
  createAsset,
  deleteAssetRow,
  findAssetById,
  findAssetByR2Key,
  findAssetByUrl,
  listAssetsByUser,
  countMenusReferencingAssetUrl,
} from '../../lib/db';
import {
  buildR2Key,
  deleteFromR2,
  getAssetPublicUrl,
  parseR2KeyFromAssetUrl,
  uploadToR2,
  validateImageUpload,
} from '../../lib/r2';
import { errorResponse, jsonResponse, parseJson } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const userId = context.data.userId as string;
  const assets = await listAssetsByUser(context.env.DB, userId);

  return jsonResponse({
    assets: assets.map((a) => ({
      id: a.id,
      type: a.type,
      url: a.url,
      r2_key: a.r2_key,
      source: a.source,
      created_at: a.created_at,
    })),
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const userId = context.data.userId as string;

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return errorResponse('Archivo requerido');
  }

  const validation = validateImageUpload(file.type, file.size);
  if (!validation.valid) {
    return errorResponse(validation.error);
  }

  const r2Key = buildR2Key(userId, file.name);
  const buffer = await file.arrayBuffer();

  await uploadToR2(env.MEDIA, r2Key, buffer, file.type);
  const url = getAssetPublicUrl(request, r2Key);
  const assetId = crypto.randomUUID();

  await createAsset(env.DB, assetId, userId, 'image', r2Key, url, 'upload');

  return jsonResponse({ asset: { id: assetId, url, r2_key: r2Key } }, 201);
};

interface DeleteAssetBody {
  id?: string;
  url?: string;
  r2_key?: string;
  /** Menú desde el que se acaba de quitar la imagen (no cuenta como referencia) */
  exclude_menu_id?: string;
  /**
   * Si true, elimina siempre de R2 y D1 aunque otros menús lo referencien
   * (gestor de archivos / acción explícita del usuario).
   */
  force?: boolean;
}

/**
 * Elimina un asset del usuario en D1 y R2.
 * Sin force: solo si ya no lo usa ningún otro menú.
 * Con force: siempre borra R2+D1 (solo el dueño vía JWT).
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const userId = context.data.userId as string;
  const body = await parseJson<DeleteAssetBody>(request);

  if (!body?.id && !body?.url && !body?.r2_key) {
    return errorResponse('id, url o r2_key requeridos');
  }

  let asset =
    (body.id ? await findAssetById(env.DB, userId, body.id) : null) ??
    (body.url ? await findAssetByUrl(env.DB, userId, body.url) : null) ??
    (body.r2_key ? await findAssetByR2Key(env.DB, userId, body.r2_key) : null);

  if (!asset && body.url) {
    const key = parseR2KeyFromAssetUrl(body.url);
    if (key) {
      asset = await findAssetByR2Key(env.DB, userId, key);
    }
  }

  if (!asset || asset.user_id !== userId) {
    return errorResponse('Recurso no encontrado', 404);
  }

  if (!body.force) {
    const urlToCheck = asset.url ?? body.url ?? '';
    const refs = await countMenusReferencingAssetUrl(
      env.DB,
      userId,
      urlToCheck,
      body.exclude_menu_id,
    );

    let refsEncoded = 0;
    if (asset.r2_key) {
      const encodedPath = `/api/assets/file/${encodeURIComponent(asset.r2_key)}`;
      if (encodedPath !== urlToCheck) {
        refsEncoded = await countMenusReferencingAssetUrl(
          env.DB,
          userId,
          encodedPath,
          body.exclude_menu_id,
        );
      }
    }

    if (refs + refsEncoded > 0) {
      return jsonResponse({
        deleted: false,
        kept: true,
        reason: 'La imagen sigue usándose en otro menú',
      });
    }
  }

  await deleteFromR2(env.MEDIA, asset.r2_key);
  await deleteAssetRow(env.DB, asset.id, userId);

  return jsonResponse({
    deleted: true,
    id: asset.id,
    url: asset.url,
    r2_key: asset.r2_key,
  });
};
