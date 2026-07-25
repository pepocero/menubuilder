import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  DEFAULT_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  applyPageSeo,
} from '@/lib/seo';

/**
 * SEO por ruta: la landing se indexa; auth y panel privado no.
 * Las cartas públicas (/p/…) quedan indexables; el título fino lo pone PublicMenuPage.
 */
export function DocumentSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname === '/') {
      applyPageSeo({
        title: `${SITE_NAME} — ${SITE_TAGLINE}`,
        description: DEFAULT_DESCRIPTION,
        path: '/',
        index: true,
      });
      return;
    }

    if (pathname === '/login') {
      applyPageSeo({
        title: 'Iniciar sesión',
        description: `Accede a tu cuenta de ${SITE_NAME} para editar y publicar tus cartas de menú.`,
        path: pathname,
        index: false,
      });
      return;
    }

    if (pathname === '/register') {
      applyPageSeo({
        title: 'Crear cuenta',
        description: `Regístrate en ${SITE_NAME} y crea cartas de menú digitales con editor, OCR y QR.`,
        path: pathname,
        index: false,
      });
      return;
    }

    if (pathname.startsWith('/dashboard')) {
      applyPageSeo({
        title: 'Mis menús',
        path: pathname,
        index: false,
      });
      return;
    }

    if (pathname.startsWith('/templates')) {
      applyPageSeo({
        title: 'Plantillas',
        path: pathname,
        index: false,
      });
      return;
    }

    if (pathname.startsWith('/qrs')) {
      applyPageSeo({
        title: 'Códigos QR',
        path: pathname,
        index: false,
      });
      return;
    }

    if (pathname.startsWith('/documentacion')) {
      applyPageSeo({
        title: 'Documentación',
        description: `Guía de uso de ${SITE_NAME}: textos, líneas de carta, imágenes, publicación QR y exportación.`,
        path: pathname,
        index: false,
      });
      return;
    }

    if (pathname.startsWith('/editor')) {
      applyPageSeo({
        title: 'Editor',
        path: pathname,
        index: false,
      });
      return;
    }

    if (pathname.startsWith('/p/')) {
      applyPageSeo({
        title: 'Carta digital',
        description: `Carta de menú publicada con ${SITE_NAME}.`,
        path: pathname,
        index: true,
      });
      return;
    }

    applyPageSeo({
      title: SITE_NAME,
      path: pathname,
      index: false,
    });
  }, [pathname]);

  return null;
}
