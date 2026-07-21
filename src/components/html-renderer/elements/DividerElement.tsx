import type { MenuDocumentDividerElement } from '@shared/menu-document/types';
import { PositionedElement } from '../positioned-element';

interface DividerElementProps {
  element: MenuDocumentDividerElement;
}

export function DividerElement({ element }: DividerElementProps) {
  return (
    <PositionedElement box={element} className="html-renderer-divider">
      <hr
        style={{
          margin: 0,
          border: 'none',
          width: '100%',
          height: `${element.thickness}cqw`,
          background: element.color,
        }}
      />
    </PositionedElement>
  );
}
