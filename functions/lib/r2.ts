const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

export function buildR2Key(userId: string, filename: string): string {
  const safe = sanitizeFilename(filename);
  return `users/${userId}/${crypto.randomUUID()}-${safe}`;
}

export function validateImageUpload(
  contentType: string | null,
  size: number,
): { valid: true } | { valid: false; error: string } {
  if (!contentType || !ALLOWED_MIME_TYPES.has(contentType)) {
    return { valid: false, error: 'Tipo de archivo no permitido' };
  }
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: 'Archivo demasiado grande (máx 5 MB)' };
  }
  return { valid: true };
}

export async function uploadToR2(
  bucket: R2Bucket,
  key: string,
  body: ArrayBuffer | ReadableStream,
  contentType: string,
): Promise<void> {
  await bucket.put(key, body, {
    httpMetadata: { contentType },
  });
}

export async function deleteFromR2(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}

/** Extrae la r2_key de una URL pública `/api/assets/file?...` o `/api/assets/file/...` */
export function parseR2KeyFromAssetUrl(url: string): string | null {
  try {
    const marker = '/api/assets/file';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;

    const rest = url.slice(idx + marker.length);
    if (rest.startsWith('?')) {
      const params = new URLSearchParams(rest.slice(1).split('#')[0]);
      const key = params.get('key');
      if (!key) return null;
      return decodeURIComponent(key);
    }

    if (rest.startsWith('/')) {
      const encoded = rest.slice(1).split('?')[0].split('#')[0];
      if (!encoded) return null;
      return decodeURIComponent(encoded);
    }

    return null;
  } catch {
    return null;
  }
}

export async function fetchRemoteImage(
  url: string,
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'MenuBuilder/1.0' },
    });
    if (!response.ok) return null;

    const contentType = response.headers.get('Content-Type') ?? 'image/jpeg';
    if (!ALLOWED_MIME_TYPES.has(contentType.split(';')[0].trim())) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_FILE_SIZE) return null;

    return { buffer, contentType: contentType.split(';')[0].trim() };
  } catch {
    return null;
  }
}

export function getAssetPublicUrl(_request: Request, r2Key: string): string {
  // Query param: fiable aunque el path decodifique `/` (el [key] de un segmento fallaba).
  return `/api/assets/file?key=${encodeURIComponent(r2Key)}`;
}
