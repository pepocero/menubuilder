import {
  assetUrlVariantsForKey,
  belongsToUserR2Prefix,
  collectAssetUrlsFromValue,
  isAppAssetUrl,
  isMenuExportAssetKey,
  isMenuExportAssetUrl,
  parseR2KeyFromAssetUrl,
  replaceAssetUrlsInValue,
  sanitizePublicLinksInJson,
  sanitizeThumbnailForSharing,
} from '../../shared/template-content-safety';
import { createAsset } from './db';
import {
  buildR2Key,
  getAssetPublicUrl,
  sanitizeUserStorageFolder,
  uploadToR2,
} from './r2';

export interface TemplateContentFields {
  canvasData: string;
  mobileDocument: string | null;
  thumbnailUrl: string | null;
}

function parseJsonSafe(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function uniqueR2KeysFromContent(
  canvasData: string,
  mobileDocument: string | null,
  thumbnailUrl: string | null,
): Set<string> {
  const urls = new Set<string>();
  const canvas = parseJsonSafe(canvasData);
  if (canvas) collectAssetUrlsFromValue(canvas, urls);
  if (mobileDocument) {
    const mobile = parseJsonSafe(mobileDocument);
    if (mobile) collectAssetUrlsFromValue(mobile, urls);
  }
  if (thumbnailUrl && isAppAssetUrl(thumbnailUrl)) urls.add(thumbnailUrl);

  const keys = new Set<string>();
  for (const url of urls) {
    const key = parseR2KeyFromAssetUrl(url);
    if (key) keys.add(key);
  }
  return keys;
}

async function cloneR2AssetToUser(
  env: { DB: D1Database; MEDIA: R2Bucket },
  request: Request,
  sourceR2Key: string,
  recipientUserId: string,
  recipientEmail: string,
): Promise<string | null> {
  const object = await env.MEDIA.get(sourceR2Key);
  if (!object) return null;

  const contentType = object.httpMetadata?.contentType ?? 'image/png';
  const ext = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : contentType.includes('gif')
        ? 'gif'
        : 'jpg';

  const destKey = buildR2Key(recipientEmail, `template-clone.${ext}`);
  const buffer = await object.arrayBuffer();
  await uploadToR2(env.MEDIA, destKey, buffer, contentType);

  const url = getAssetPublicUrl(request, destKey);
  await createAsset(
    env.DB,
    crypto.randomUUID(),
    recipientUserId,
    'image',
    destKey,
    url,
    'template_clone',
  );
  return url;
}

async function buildCloneMapForRecipient(
  env: { DB: D1Database; MEDIA: R2Bucket },
  request: Request,
  r2Keys: Iterable<string>,
  recipientUserId: string,
  recipientEmail: string,
): Promise<Map<string, string>> {
  const folder = sanitizeUserStorageFolder(recipientEmail);
  const cloneMap = new Map<string, string>();

  for (const r2Key of r2Keys) {
    if (isMenuExportAssetKey(r2Key)) continue;
    if (belongsToUserR2Prefix(r2Key, folder)) continue;

    const newUrl = await cloneR2AssetToUser(
      env,
      request,
      r2Key,
      recipientUserId,
      recipientEmail,
    );
    if (newUrl) {
      cloneMap.set(r2Key, newUrl);
    }
  }

  return cloneMap;
}

function applyCloneMapToContent(
  canvasData: string,
  mobileDocument: string | null,
  thumbnailUrl: string | null,
  cloneMap: Map<string, string>,
): TemplateContentFields {
  let canvas = parseJsonSafe(canvasData);
  if (canvas) {
    canvas = replaceAssetUrlsInValue(canvas, cloneMap);
    canvas = sanitizePublicLinksInJson(canvas);
  }

  let mobile: unknown = null;
  if (mobileDocument) {
    mobile = parseJsonSafe(mobileDocument);
    if (mobile) {
      mobile = replaceAssetUrlsInValue(mobile, cloneMap);
      mobile = sanitizePublicLinksInJson(mobile);
    }
  }

  let thumb = thumbnailUrl;
  if (thumb) {
    const key = parseR2KeyFromAssetUrl(thumb);
    if (key && cloneMap.has(key)) {
      thumb = cloneMap.get(key)!;
    } else if (isMenuExportAssetUrl(thumb)) {
      thumb = null;
    }
    thumb = sanitizeThumbnailForSharing(thumb);
  }

  return {
    canvasData: canvas ? JSON.stringify(canvas) : canvasData,
    mobileDocument: mobile ? JSON.stringify(mobile) : mobileDocument,
    thumbnailUrl: thumb,
  };
}

/** Limpia enlaces públicos antes de guardar/compartir plantilla (mismo autor). */
export function sanitizeTemplateContentForSharing(
  input: TemplateContentFields,
  ownerEmail: string,
): TemplateContentFields {
  const folder = sanitizeUserStorageFolder(ownerEmail);
  const keys = uniqueR2KeysFromContent(
    input.canvasData,
    input.mobileDocument,
    input.thumbnailUrl,
  );

  // Quitar referencias a exportaciones de menú publicado (no deben compartirse).
  for (const key of keys) {
    if (isMenuExportAssetKey(key) && belongsToUserR2Prefix(key, folder)) {
      // Se eliminarán al reemplazar URLs en applyCloneMap con mapa vacío + sanitize thumb
    }
  }

  let canvas = parseJsonSafe(input.canvasData);
  if (canvas) canvas = sanitizePublicLinksInJson(canvas);

  let mobile: unknown = null;
  if (input.mobileDocument) {
    mobile = parseJsonSafe(input.mobileDocument);
    if (mobile) mobile = sanitizePublicLinksInJson(mobile);
  }

  let thumb = sanitizeThumbnailForSharing(input.thumbnailUrl);
  if (thumb && isMenuExportAssetUrl(thumb)) thumb = null;

  // Eliminar export PNG del autor embebido en capas (no clonar: solo quitar URL).
  const stripMenuExportKeys = new Map<string, string>();
  for (const key of keys) {
    if (isMenuExportAssetKey(key)) {
      stripMenuExportKeys.set(key, '');
    }
  }

  if (canvas && stripMenuExportKeys.size > 0) {
    canvas = replaceAssetUrlsInValue(canvas, stripMenuExportKeys);
  }
  if (mobile && stripMenuExportKeys.size > 0) {
    mobile = replaceAssetUrlsInValue(mobile, stripMenuExportKeys);
  }

  return {
    canvasData: canvas ? JSON.stringify(canvas) : input.canvasData,
    mobileDocument: mobile ? JSON.stringify(mobile) : input.mobileDocument,
    thumbnailUrl: thumb,
  };
}

/** Clona assets ajenos y elimina enlaces públicos al instanciar plantilla para otro usuario. */
export async function sanitizeTemplateContentForRecipient(
  input: TemplateContentFields,
  options: {
    env: { DB: D1Database; MEDIA: R2Bucket };
    request: Request;
    recipientUserId: string;
    recipientEmail: string;
  },
): Promise<TemplateContentFields> {
  const keys = uniqueR2KeysFromContent(
    input.canvasData,
    input.mobileDocument,
    input.thumbnailUrl,
  );

  const cloneMap = await buildCloneMapForRecipient(
    options.env,
    options.request,
    keys,
    options.recipientUserId,
    options.recipientEmail,
  );

  return applyCloneMapToContent(
    input.canvasData,
    input.mobileDocument,
    input.thumbnailUrl,
    cloneMap,
  );
}

/** Variantes de URL usadas en comprobaciones de acceso público. */
export function publicUrlVariantsForR2Key(r2Key: string): string[] {
  return assetUrlVariantsForKey(r2Key);
}
