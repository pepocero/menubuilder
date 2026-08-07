import {
  createAsset,
  deleteAssetRow,
  findAssetById,
  findAssetByR2Key,
  findAssetByUrl,
  listAssetsByUser,
} from '../../lib/db';
import {
  countMenusReferencingAsset,
  deleteAssetIfUnreferenced,
} from '../../lib/asset-refs';
import {
  buildR2Key,
  deleteFromR2,
  getAssetPublicUrl,
  parseR2KeyFromAssetUrl,
  uploadToR2,
  validateImageUpload,
} from '../../lib/r2';
import { errorResponse, jsonResponse, parseJson } from '../../lib/types';

/** Assets recién creados (p. ej. stock a mitad de optimizar) no se borran aún. */
const ORPHAN_GRACE_MS = 5 * 60 * 1000;

function assetAgeMs(createdAt: string): number {
  const normalized = createdAt.includes('T') ? createdAt : createdAt.replace(' ', 'T');
  const ts = Date.parse(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  if (Number.isNaN(ts)) return ORPHAN_GRACE_MS;
  return Math.max(0, Date.now() - ts);
}

/** Borra del usuario archivos en R2/D1 que no referencia ningún menú (con gracia). */
async function garbageCollectOrphanAssets(env: Env, userId: string): Promise<number> {
  const assets = await listAssetsByUser(env.DB, userId);
  let deleted = 0;
  for (const asset of assets) {
    if (assetAgeMs(asset.created_at) < ORPHAN_GRACE_MS) continue;
    const refs = await countMenusReferencingAsset(env.DB, userId, asset);
    if (refs > 0) continue;
    try {
      if (env.MEDIA) await deleteFromR2(env.MEDIA, asset.r2_key);
      await deleteAssetRow(env.DB, asset.id, userId);
      deleted += 1;
    } catch (err) {
      console.error('GC huérfano falló', asset.id, err);
    }
  }
  return deleted;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const userId = context.data.userId as string;
  try {
    await garbageCollectOrphanAssets(context.env, userId);
  } catch (err) {
    console.error('GC huérfanos en listado falló', err);
  }
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
  const email = context.data.email as string;

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return errorResponse('Archivo requerido');
  }

  const validation = validateImageUpload(file.type, file.size);
  if (!validation.valid) {
    return errorResponse(validation.error);
  }

  const r2Key = buildR2Key(email, file.name);
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
  exclude_menu_id?: string;
  force?: boolean;
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const userId = context.data.userId as string;

  try {
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
      if (key) asset = await findAssetByR2Key(env.DB, userId, key);
    }

    if (!asset || asset.user_id !== userId) {
      return errorResponse('Recurso no encontrado', 404);
    }

    const url =
      body.url ?? asset.url ?? `/api/assets/file?key=${encodeURIComponent(asset.r2_key)}`;

    const result = await deleteAssetIfUnreferenced(env, userId, url, {
      excludeMenuId: body.exclude_menu_id,
      force: body.force,
    });

    if (result.reason === 'not_found') {
      return errorResponse('Recurso no encontrado', 404);
    }

    if (!result.deleted) {
      return jsonResponse({
        deleted: false,
        kept: true,
        reason: result.reason ?? 'La imagen sigue usándose en otro menú',
      });
    }

    return jsonResponse({
      deleted: true,
      id: asset.id,
      url: asset.url,
      r2_key: asset.r2_key,
    });
  } catch (err) {
    console.error('DELETE /api/assets falló', err);
    return errorResponse('No se pudo eliminar el archivo', 500);
  }
};
