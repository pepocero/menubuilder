import type { MobileMenuDocument } from '@shared/mobile-menu';
import { MobileRuntimeRenderer } from './MobileRuntimeRenderer';

interface MobilePublicViewProps {
  document: MobileMenuDocument;
}

export function MobilePublicView({ document }: MobilePublicViewProps) {
  return (
    <div className="mobile-public-view mobile-public-view--fullscreen">
      <MobileRuntimeRenderer document={document} />
    </div>
  );
}
