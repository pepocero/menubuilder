/** Configuración SEO compartida (meta, Open Graph, JSON-LD). */

export const SITE_NAME = 'Paper To Menu';

export const SITE_TAGLINE = 'Cartas de menú digitales para restaurantes';

export const DEFAULT_SITE_URL = 'https://papertomenu.com';

export const DEFAULT_DESCRIPTION =
  'Crea y publica cartas de menú digitales para restaurantes, bares y cafeterías. Editor visual, importación con OCR, plantillas, QR en mesa y exportación PNG/PDF.';

export const DEFAULT_KEYWORDS = [
  'carta digital restaurante',
  'menú digital QR',
  'crear carta menú online',
  'editor carta restaurante',
  'importar menú OCR',
  'menú con código QR',
  'Paper To Menu',
  'PaperToMenu',
].join(', ');

/** Imagen social relativa al origen del sitio. */
export const DEFAULT_OG_IMAGE = '/landing/editor-layers.jpg';

export type PageSeoOptions = {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  /** Si es false, Google no indexa la ruta (login, panel, editor…). */
  index?: boolean;
  type?: 'website' | 'article';
};

function ensureMeta(attr: 'name' | 'property', key: string, content: string): void {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function ensureLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export function getSiteOrigin(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  // Dominio público canónico (QR, enlaces /p/…, SEO). No usar window.location
  // para no generar URLs de previews (*.pages.dev) u orígenes temporales.
  return DEFAULT_SITE_URL;
}

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const origin = getSiteOrigin();
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return origin ? `${origin}${path}` : path;
}

export function formatDocumentTitle(title: string): string {
  if (title === SITE_NAME || title.startsWith(`${SITE_NAME} `) || title.startsWith(`${SITE_NAME}—`) || title.startsWith(`${SITE_NAME} —`)) {
    return title;
  }
  return `${title} — ${SITE_NAME}`;
}

/** Actualiza title, description, robots, canonical y Open Graph/Twitter. */
export function applyPageSeo(options: PageSeoOptions): void {
  const description = options.description ?? DEFAULT_DESCRIPTION;
  const index = options.index !== false;
  const path = options.path ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  const canonical = absoluteUrl(path === '' ? '/' : path);
  const image = absoluteUrl(options.image ?? DEFAULT_OG_IMAGE);
  const title = formatDocumentTitle(options.title);

  document.title = title;
  document.documentElement.lang = 'es';

  ensureMeta('name', 'description', description);
  ensureMeta('name', 'keywords', DEFAULT_KEYWORDS);
  ensureMeta('name', 'robots', index ? 'index, follow, max-image-preview:large' : 'noindex, nofollow');
  ensureMeta('name', 'googlebot', index ? 'index, follow' : 'noindex, nofollow');
  ensureMeta('name', 'author', 'CarliniTools');
  ensureMeta('name', 'theme-color', '#1a3329');

  ensureLink('canonical', canonical);

  ensureMeta('property', 'og:type', options.type ?? 'website');
  ensureMeta('property', 'og:site_name', SITE_NAME);
  ensureMeta('property', 'og:locale', 'es_ES');
  ensureMeta('property', 'og:title', title);
  ensureMeta('property', 'og:description', description);
  ensureMeta('property', 'og:url', canonical);
  ensureMeta('property', 'og:image', image);
  ensureMeta('property', 'og:image:alt', `${SITE_NAME} — editor de cartas de menú`);

  ensureMeta('name', 'twitter:card', 'summary_large_image');
  ensureMeta('name', 'twitter:title', title);
  ensureMeta('name', 'twitter:description', description);
  ensureMeta('name', 'twitter:image', image);
}
