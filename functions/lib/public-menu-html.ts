import { toPublicMenuAssetUrl } from '../../shared/public-menu-assets';
import type { MobileComponent, MobileMenuDocument } from '../../shared/mobile-menu';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shadowCss(intensity?: number): string {
  const i = Math.max(1, Math.min(10, intensity ?? 4));
  const y = Math.max(1, Math.round(i * 0.45));
  const blur = Math.max(2, Math.round(i * 1.2));
  const alpha = Math.min(0.9, 0.2 + i * 0.07);
  return `0 ${y}px ${blur}px rgba(0,0,0,${alpha.toFixed(2)})`;
}

function typographyStyle(
  typography: MobileComponent['typography'],
  fallbackColor: string,
): string {
  if (!typography) return `color:${escapeHtml(fallbackColor)}`;
  const parts = [
    `font-family:${escapeHtml(typography.fontFamily || 'system-ui,sans-serif')}`,
    `font-size:${typography.fontSize}px`,
    `font-weight:${typography.fontWeight}`,
    `font-style:${typography.fontStyle}`,
    `text-decoration:${typography.textDecoration}`,
    `text-transform:${typography.textTransform}`,
    `text-align:${typography.textAlign}`,
    `line-height:${typography.lineHeight}`,
    `letter-spacing:${typography.letterSpacing}px`,
    `color:${escapeHtml(typography.color || fallbackColor)}`,
  ];
  if (typography.textShadow) {
    parts.push(`text-shadow:${shadowCss(typography.textShadowIntensity)}`);
  }
  return parts.join(';');
}

function sectionBgStyle(
  slug: string,
  bg: { src?: string; align?: string } | undefined,
): string {
  if (!bg?.src?.trim()) return '';
  const url = toPublicMenuAssetUrl(slug, bg.src.trim());
  const align = bg.align === 'top' ? 'top' : bg.align === 'bottom' ? 'bottom' : 'center';
  return `background-image:url('${escapeHtml(url)}');background-size:cover;background-position:${align};background-repeat:no-repeat;`;
}

function renderMenuItem(
  slug: string,
  component: Extract<MobileComponent, { type: 'menuItem' }>,
): string {
  const titleStyle = typographyStyle(
    component.menuTypography?.title,
    '#111827',
  );
  const priceStyle = typographyStyle(
    component.menuTypography?.price,
    '#111827',
  );
  const ingredientsStyle = typographyStyle(
    component.menuTypography?.ingredients,
    '#6b7280',
  );
  const imageSrc = component.menuImage?.src?.trim()
    ? toPublicMenuAssetUrl(slug, component.menuImage.src.trim())
    : '';
  const imageHtml = imageSrc
    ? `<img class="dish-img" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(component.menuImage?.alt || component.title)}" loading="lazy" decoding="async" width="92" height="92" />`
    : '';

  const ingredients =
    component.ingredients?.trim() &&
    component.ingredientsDisplay !== 'hidden'
      ? `<p class="dish-ingredients" style="${ingredientsStyle}">${escapeHtml(component.ingredients).replace(/\n/g, '<br />')}</p>`
      : '';

  const allergens = component.allergens?.trim()
    ? `<p class="dish-allergens">${escapeHtml(component.allergens).replace(/\n/g, ', ')}</p>`
    : '';

  return `<article class="dish" style="background-color:${escapeHtml(component.backgroundColor || '#fff')}">
    <div class="dish-row">
      ${imageHtml}
      <div class="dish-main">
        <div class="dish-title-row">
          <h3 class="dish-title" style="${titleStyle}">${escapeHtml(component.title)}</h3>
          <span class="dish-price" style="${priceStyle}">${escapeHtml(component.price || '')}</span>
        </div>
        ${ingredients}
        ${allergens}
      </div>
    </div>
  </article>`;
}

function renderComponent(slug: string, component: MobileComponent): string {
  if (component.hidden === true) return '';

  switch (component.type) {
    case 'section': {
      const style = [
        sectionBgStyle(slug, component.backgroundImage),
        `background-color:${escapeHtml(component.backgroundColor || '#fff')}`,
        `padding:${component.padding ?? 16}px`,
        typographyStyle(component.typography, '#111827'),
      ].join(';');
      return `<section class="block block-section" style="${style}">
        ${component.title ? `<h2 class="section-title">${escapeHtml(component.title)}</h2>` : ''}
      </section>`;
    }
    case 'heading':
      return `<h2 class="block block-heading" style="${typographyStyle(component.typography, '#111827')}">${escapeHtml(component.text)}</h2>`;
    case 'text':
      return `<p class="block block-text" style="${typographyStyle(component.typography, '#374151')}">${escapeHtml(component.text).replace(/\n/g, '<br />')}</p>`;
    case 'image': {
      const src = component.src?.trim() ? toPublicMenuAssetUrl(slug, component.src.trim()) : '';
      if (!src) return '';
      return `<figure class="block block-image"><img src="${escapeHtml(src)}" alt="${escapeHtml(component.alt || '')}" loading="lazy" decoding="async" /></figure>`;
    }
    case 'menuItem':
      return renderMenuItem(slug, component);
    case 'divider':
      return `<hr class="block block-divider" style="border:none;border-top:${component.thickness ?? 1}px solid ${escapeHtml(component.color || '#e5e7eb')}" />`;
    case 'spacer':
      return `<div class="block block-spacer" style="height:${Math.max(4, component.height ?? 16)}px" aria-hidden="true"></div>`;
    case 'button': {
      const href = component.href?.trim() && component.href !== '#' ? component.href.trim() : '';
      const label = escapeHtml(component.label || 'Enlace');
      if (!href) return `<div class="block block-button"><span class="btn-ghost">${label}</span></div>`;
      return `<div class="block block-button"><a class="btn" href="${escapeHtml(href)}" rel="noopener noreferrer">${label}</a></div>`;
    }
    case 'accordion': {
      const header = component.children[0];
      const body = component.children.slice(1);
      const openAttr = component.defaultOpen ? ' open' : '';
      const showChevron = component.showChevron !== false;
      const chevronColor = escapeHtml(component.chevronColor?.trim() || '#64748b');
      const headHtml = header ? renderComponent(slug, header) : '<span>Sección</span>';
      const bodyHtml = body.map((child) => renderComponent(slug, child)).join('');
      const chevronFilter =
        component.chevronShadow === true
          ? `filter:drop-shadow(${shadowCss(component.chevronShadowIntensity)});`
          : '';
      return `<details class="block block-accordion"${openAttr}>
        <summary class="acc-summary">
          <div class="acc-head">${headHtml}</div>
          ${showChevron ? `<span class="acc-chevron" style="color:${chevronColor};${chevronFilter}" aria-hidden="true">▾</span>` : ''}
        </summary>
        <div class="acc-body">${bodyHtml}</div>
      </details>`;
    }
    default:
      return '';
  }
}

const LITE_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f8fafc;color:#111827;line-height:1.45}
.public-lite{max-width:520px;margin:0 auto;padding:0 0 24px;min-height:100dvh;background:var(--bg,#f8fafc)}
.public-lite-header{padding:14px 16px 8px}
.public-lite-header h1{margin:0;font-size:1.05rem;font-weight:700}
.public-lite-main{display:flex;flex-direction:column;gap:8px;padding:0 8px 16px}
.block-section{border-radius:12px;min-height:48px;display:flex;align-items:center;justify-content:center}
.section-title{margin:0;width:100%}
.block-heading,.block-text{margin:0;padding:0 8px}
.block-image img{display:block;width:100%;height:auto;border-radius:12px}
.block-divider{margin:8px 0}
.block-button{padding:0 8px}
.btn,.btn-ghost{display:inline-block;padding:10px 14px;border-radius:10px;text-decoration:none}
.btn{background:#1a3329;color:#fff}
.btn-ghost{background:#e5e7eb;color:#111827}
.block-accordion{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.acc-summary{list-style:none;display:flex;align-items:stretch;gap:8px;cursor:pointer;padding:0}
.acc-summary::-webkit-details-marker{display:none}
.acc-head{flex:1;min-width:0}
.acc-head .block-section{border-radius:0;margin:0}
.acc-chevron{align-self:center;flex:0 0 28px;font-size:22px;line-height:1;padding-right:10px;transition:transform .2s ease}
.block-accordion[open] .acc-chevron{transform:rotate(180deg)}
.acc-body{padding:0 0 8px}
.dish{padding:12px 14px;border-top:1px solid #f1f5f9}
.dish-row{display:flex;gap:12px;align-items:flex-start}
.dish-img{width:92px;height:92px;object-fit:cover;border-radius:10px;flex:0 0 92px}
.dish-main{flex:1;min-width:0}
.dish-title-row{display:flex;gap:10px;align-items:flex-start;justify-content:space-between}
.dish-title{margin:0;font-size:inherit;flex:1}
.dish-price{white-space:nowrap;font-weight:700}
.dish-ingredients{margin:6px 0 0;font-size:.85em}
.dish-allergens{margin:4px 0 0;font-size:.75em;color:#b45309}
.public-lite-footer{padding:12px 16px 20px;text-align:center;font-size:.75rem;color:#64748b}
.public-lite-footer a{color:#1a3329}
`;

export function renderMobilePublicMenuHtml(input: {
  slug: string;
  title: string;
  document: MobileMenuDocument;
}): string {
  const { slug, title, document } = input;
  const safeTitle = escapeHtml(title.trim() || 'Carta digital');
  const bg = escapeHtml(document.theme?.backgroundColor || '#f8fafc');
  const body = document.components.map((c) => renderComponent(slug, c)).join('\n');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="theme-color" content="#1a3329" />
  <meta name="robots" content="index,follow" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeTitle} — carta digital" />
  <link rel="canonical" href="https://papertomenu.com/p/${escapeHtml(slug)}" />
  <style>${LITE_CSS}</style>
</head>
<body>
  <div class="public-lite" style="--bg:${bg};background:${bg}">
    <header class="public-lite-header">
      <h1>${safeTitle}</h1>
    </header>
    <main class="public-lite-main">
      ${body}
    </main>
    <footer class="public-lite-footer">
      <a href="/p/${escapeHtml(slug)}?spa=1">Versión completa</a>
    </footer>
  </div>
</body>
</html>`;
}

export function renderExportPngFallbackHtml(input: {
  slug: string;
  title: string;
  pngUrl: string;
}): string {
  const safeTitle = escapeHtml(input.title.trim() || 'Carta digital');
  const src = escapeHtml(toPublicMenuAssetUrl(input.slug, input.pngUrl));
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>${safeTitle}</title>
  <style>
    body{margin:0;background:#111827;color:#fff;font-family:system-ui,sans-serif}
    .wrap{max-width:900px;margin:0 auto;padding:12px}
    img{display:block;width:100%;height:auto}
  </style>
</head>
<body>
  <div class="wrap">
    <img src="${src}" alt="${safeTitle}" loading="eager" decoding="async" />
  </div>
</body>
</html>`;
}

export function isMobileUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(userAgent);
}
