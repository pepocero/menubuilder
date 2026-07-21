import type { MenuDocumentImageElement } from '@shared/menu-document/types';
import { PositionedElement } from '../positioned-element';

interface ImageElementProps {
  element: MenuDocumentImageElement;
}

export function ImageElement({ element }: ImageElementProps) {
  return (
    <PositionedElement box={element} className="html-renderer-image">
      <figure
        style={{
          margin: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <img
          src={element.src}
          alt={element.alt ?? ''}
          draggable={false}
          decoding="async"
          loading="lazy"
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: element.objectFit ?? 'cover',
          }}
        />
      </figure>
    </PositionedElement>
  );
}
