import type { MenuDocumentTextElement } from '@shared/menu-document/types';
import { PositionedElement, textTagForSemantic } from '../positioned-element';

interface TextElementProps {
  element: MenuDocumentTextElement;
}

export function TextElement({ element }: TextElementProps) {
  const Tag = textTagForSemantic(element.semantic);

  return (
    <PositionedElement box={element} className="html-renderer-text">
      <Tag
        style={{
          margin: 0,
          padding: 0,
          width: '100%',
          height: '100%',
          fontFamily: element.style.fontFamily,
          fontSize: `${element.style.fontSize}cqw`,
          fontWeight: element.style.fontWeight,
          lineHeight: element.style.lineHeight ?? 1.2,
          letterSpacing: element.style.letterSpacing
            ? `${element.style.letterSpacing}cqw`
            : undefined,
          textAlign: element.style.textAlign,
          textTransform: element.style.textTransform,
          color: element.style.color,
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
        }}
      >
        {element.text}
      </Tag>
    </PositionedElement>
  );
}
