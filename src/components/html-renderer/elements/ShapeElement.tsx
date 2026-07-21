import type { MenuDocumentShapeElement } from '@shared/menu-document/types';
import { PositionedElement } from '../positioned-element';

interface ShapeElementProps {
  element: MenuDocumentShapeElement;
}

export function ShapeElement({ element }: ShapeElementProps) {
  const borderWidth = element.strokeWidth ? `${element.strokeWidth}cqw` : undefined;

  return (
    <PositionedElement box={element} className="html-renderer-shape">
      <div
        role="presentation"
        style={{
          width: '100%',
          height: '100%',
          background: element.fill ?? 'transparent',
          border: element.stroke && borderWidth
            ? `${borderWidth} solid ${element.stroke}`
            : undefined,
          borderRadius: element.shape === 'circle' ? '50%' : undefined,
        }}
      />
    </PositionedElement>
  );
}
