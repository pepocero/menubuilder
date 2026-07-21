import type { MenuDocument } from '@shared/menu-document/types';
import { SectionElement } from './elements/SectionElement';

interface HtmlRendererProps {
  document: MenuDocument;
  title?: string;
  showTitle?: boolean;
}

/**
 * Renderiza un MenuDocument como HTML responsive.
 * No depende del editor ni de Fabric.js.
 */
export function HtmlRenderer({ document, title, showTitle = false }: HtmlRendererProps) {
  return (
    <article className="html-renderer" aria-label={title ?? 'Carta de menú'}>
      {showTitle && title ? (
        <header className="html-renderer-header">
          <h1 className="html-renderer-title">{title}</h1>
        </header>
      ) : null}

      <div className="html-renderer-pages">
        {document.pages.map((page, index) => (
          <SectionElement
            key={page.id}
            page={page}
            index={index}
            total={document.pages.length}
          />
        ))}
      </div>
    </article>
  );
}
