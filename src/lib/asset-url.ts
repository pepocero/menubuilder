/**
 * Normaliza URLs de assets para que carguen en cualquier navegador.
 * Las URLs antiguas `/api/assets/file/${encodeURIComponent(key)}` fallan si el
 * runtime decodifica `%2F` a `/` (el route de un segmento deja de coincidir).
 */
export function normalizeAssetUrl(src: string | null | undefined): string {
  if (!src) return '';
  const marker = '/api/assets/file';
  const idx = src.indexOf(marker);
  if (idx === -1) return src;

  const rest = src.slice(idx + marker.length);

  // Ya en formato query
  if (rest.startsWith('?')) {
    try {
      const params = new URLSearchParams(rest.slice(1).split('#')[0]);
      const key = params.get('key');
      if (!key) return src;
      return `${marker}?key=${encodeURIComponent(decodeURIComponent(key))}`;
    } catch {
      return src;
    }
  }

  // Path: /api/assets/file/<encoded-or-segments>
  if (rest.startsWith('/')) {
    const pathPart = rest.slice(1).split('?')[0].split('#')[0];
    if (!pathPart) return src;
    try {
      const key = decodeURIComponent(pathPart);
      return `${marker}?key=${encodeURIComponent(key)}`;
    } catch {
      return `${marker}?key=${encodeURIComponent(pathPart)}`;
    }
  }

  return src;
}
