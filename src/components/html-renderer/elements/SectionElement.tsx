import type { MenuDocumentElement, MenuDocumentPage } from '@shared/menu-document/types';
import { DividerElement } from './DividerElement';
import { ImageElement } from './ImageElement';
import { ShapeElement } from './ShapeElement';
import { TextElement } from './TextElement';

interface SectionElementProps {
  page: MenuDocumentPage;
  index: number;
  total: number;
}

function renderElement(element: MenuDocumentElement) {
  switch (element.type) {
    case 'text':
      return <TextElement key={element.id} element={element} />;
    case 'image':
      return <ImageElement key={element.id} element={element} />;
    case 'shape':
      return <ShapeElement key={element.id} element={element} />;
    case 'divider':
      return <DividerElement key={element.id} element={element} />;
    default:
      return null;
  }
}

export function SectionElement({ page, index, total }: SectionElementProps) {
  const { canvas } = page;
  const isLast = index === total - 1;
  const w = Math.max(canvas.width || 595, 1);
  const h = Math.max(canvas.height || 842, 1);

  return (
    <section
      className="html-renderer-section"
      aria-label={`Página ${index + 1} de ${total}`}
      style={{
        // Reserva altura por ratio (fiable en móvil; el contenido es absolute).
        height: 0,
        paddingBottom: `${(h / w) * 100}%`,
        background: canvas.background,
      }}
    >
      {canvas.backgroundImage ? (
        <img
          className="html-renderer-section-bg"
          src={canvas.backgroundImage}
          alt=""
          draggable={false}
          decoding="async"
        />
      ) : null}

      <div className="html-renderer-section-content">
        {page.elements.map(renderElement)}
      </div>

      {isLast ? (
        <footer className="html-renderer-section-footer" aria-hidden="true" />
      ) : null}
    </section>
  );
}
