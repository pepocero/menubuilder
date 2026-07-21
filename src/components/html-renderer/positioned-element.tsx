import type { MenuDocumentBox, MenuDocumentTextElement } from '@shared/menu-document/types';

export interface PositionedElementProps {
  box: MenuDocumentBox;
  className?: string;
  children: React.ReactNode;
}

export function PositionedElement({ box, className, children }: PositionedElementProps) {
  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        left: `${box.x}%`,
        top: `${box.y}%`,
        width: `${box.width}%`,
        height: `${box.height}%`,
        transform: box.rotation ? `rotate(${box.rotation}deg)` : undefined,
        transformOrigin: 'top left',
        opacity: box.opacity ?? 1,
        zIndex: box.zIndex,
      }}
    >
      {children}
    </div>
  );
}

export function textTagForSemantic(
  semantic: MenuDocumentTextElement['semantic'],
): 'h1' | 'h2' | 'p' | 'small' {
  switch (semantic) {
    case 'heading':
      return 'h1';
    case 'subheading':
      return 'h2';
    case 'caption':
      return 'small';
    default:
      return 'p';
  }
}
