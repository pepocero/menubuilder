import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_SITE_URL = 'https://menubuilder.carlinitools.com';

function resolveSiteUrl(mode: string): string {
  const env = loadEnv(mode, process.cwd(), '');
  return (env.VITE_SITE_URL || process.env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
}

/** Reescribe robots.txt y sitemap.xml en dist con la URL canónica del sitio. */
function seoStaticFilesPlugin(siteUrl: string): Plugin {
  return {
    name: 'menu-seo-static-files',
    transformIndexHtml(html) {
      return html.replaceAll(DEFAULT_SITE_URL, siteUrl);
    },
    closeBundle() {
      const dist = path.resolve(__dirname, 'dist');
      if (!fs.existsSync(dist)) return;

      const lastmod = new Date().toISOString().slice(0, 10);

      fs.writeFileSync(
        path.join(dist, 'robots.txt'),
        `User-agent: *
Allow: /
Allow: /landing/
Allow: /templates/images/

Disallow: /login
Disallow: /register
Disallow: /dashboard
Disallow: /templates
Disallow: /qrs
Disallow: /editor/
Disallow: /api/

Sitemap: ${siteUrl}/sitemap.xml
`,
        'utf8',
      );

      fs.writeFileSync(
        path.join(dist, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`,
        'utf8',
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const siteUrl = resolveSiteUrl(mode);

  return {
    plugins: [react(), seoStaticFilesPlugin(siteUrl)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, './shared'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:8788',
          changeOrigin: true,
        },
      },
    },
  };
});
