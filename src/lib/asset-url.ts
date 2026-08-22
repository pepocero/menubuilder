/**
 * Normaliza URLs de assets para que carguen en cualquier navegador.
 * Las URLs antiguas `/api/assets/file/${encodeURIComponent(key)}` fallan si el
 * runtime decodifica `%2F` a `/` (el route de un segmento deja de coincidir).
 *
 * Implementación canónica en shared; este módulo reexporta para el cliente.
 */
export { normalizeAssetUrl, normalizeAssetUrlsInValue } from '@shared/asset-url';
