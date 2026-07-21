/** Sube el PNG de exportación (data URL) a R2 y devuelve la URL pública. */
export function parsePngDataUrl(
  dataUrl: string,
): { buffer: ArrayBuffer; contentType: string } | null {
  const match = /^data:(image\/png);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;

  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { buffer: bytes.buffer, contentType: match[1] };
  } catch {
    return null;
  }
}

export function buildMenuExportPngKey(userId: string, menuId: string): string {
  return `users/${userId}/menus/${menuId}/menu.png`;
}

export async function uploadMenuExportPng(
  bucket: R2Bucket,
  userId: string,
  menuId: string,
  dataUrl: string,
  getPublicUrl: (r2Key: string) => string,
): Promise<string | null> {
  const parsed = parsePngDataUrl(dataUrl);
  if (!parsed) return null;

  const key = buildMenuExportPngKey(userId, menuId);
  await bucket.put(key, parsed.buffer, {
    httpMetadata: { contentType: parsed.contentType },
  });

  return getPublicUrl(key);
}

export async function deleteMenuExportPng(
  bucket: R2Bucket,
  userId: string,
  menuId: string,
): Promise<void> {
  const key = buildMenuExportPngKey(userId, menuId);
  await bucket.delete(key);
}
