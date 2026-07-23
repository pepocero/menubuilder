import { useEffect } from 'react';
import type { MenuDocumentTextElement } from '@shared/menu-document/types';
import { ensureEditorFontLoaded } from '@/lib/google-fonts';
import { renderTextContentWithCharStyles } from '@/lib/text-char-styles';
import { PositionedElement, textTagForSemantic } from '../positioned-element';

interface TextElementProps {
  element: MenuDocumentTextElement;
}

function borderCss(element: MenuDocumentTextElement): React.CSSProperties {
  const b = element.style.border;
  if (!b || b.style === 'none' || !(b.width > 0)) return {};
  const style =
    b.style === 'dashed' ? 'dashed' : b.style === 'dotted' ? 'dotted' : 'solid';
  const gap = b.margin ?? b.padding ?? 0;
  return {
    boxSizing: 'border-box',
    border: `${b.width}cqw ${style} ${b.color}`,
    borderRadius: `${b.radius ?? 0}cqw`,
    // En CSS, el espacio dentro del borde hasta el texto es padding.
    ...(gap > 0 ? { padding: `${gap}cqw` } : {}),
  };
}

export function TextElement({ element }: TextElementProps) {
  const Tag = textTagForSemantic(element.semantic);

  useEffect(() => {
    try {
      ensureEditorFontLoaded(element.style.fontFamily);
      if (!element.charStyles) return;
      for (const line of Object.values(element.charStyles)) {
        for (const style of Object.values(line)) {
          if (typeof style.fontFamily === 'string') {
            ensureEditorFontLoaded(style.fontFamily);
          }
        }
      }
    } catch {
      /* fuentes opcionales */
    }
  }, [element]);

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
          fontStyle: element.style.fontStyle,
          lineHeight: element.style.lineHeight ?? 1.2,
          letterSpacing: element.style.letterSpacing
            ? `${element.style.letterSpacing}cqw`
            : undefined,
          textAlign: element.style.textAlign,
          textTransform: element.style.textTransform,
          color: element.style.color,
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
          ...borderCss(element),
        }}
      >
        {renderTextContentWithCharStyles(
          element.text,
          element.charStyles,
          {
            color: element.style.color,
            fontFamily: element.style.fontFamily,
            fontSize: element.style.fontSize,
            fontWeight: element.style.fontWeight,
            fontStyle: element.style.fontStyle,
          },
          1,
          'cqw',
        )}
      </Tag>
    </PositionedElement>
  );
}
