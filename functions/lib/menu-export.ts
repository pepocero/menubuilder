/** Sube el PNG de exportación (data URL) a R2 y devuelve la URL pública. */
import { buildUserR2Prefix } from './r2';

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

export function buildMenuExportPngKey(email: string, menuId: string): string {
  return `${buildUserR2Prefix(email)}/menus/${menuId}/menu.png`;
}

export async function uploadMenuExportPng(
  bucket: R2Bucket,
  email: string,
  menuId: string,
  dataUrl: string,
  getPublicUrl: (r2Key: string) => string,
  /** Si se pasa, elimina la exportación antigua bajo `users/<userId>/…`. */
  userId?: string,
): Promise<string | null> {
  const parsed = parsePngDataUrl(dataUrl);
  if (!parsed) return null;

  const key = buildMenuExportPngKey(email, menuId);
  await bucket.put(key, parsed.buffer, {
    httpMetadata: { contentType: parsed.contentType },
  });

  if (userId) {
    try {
      await bucket.delete(`users/${userId}/menus/${menuId}/menu.png`);
    } catch {
      /* best-effort */
    }
  }

  return getPublicUrl(key);
}

export async function deleteMenuExportPng(
  bucket: R2Bucket,
  email: string,
  menuId: string,
  /** Si se pasa, también borra la ruta antigua `users/<userId>/…`. */
  userId?: string,
): Promise<void> {
  await bucket.delete(buildMenuExportPngKey(email, menuId));
  if (userId) {
    await bucket.delete(`users/${userId}/menus/${menuId}/menu.png`);
  }
}
