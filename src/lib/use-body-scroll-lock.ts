import { useEffect } from 'react';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/body-scroll-lock';

/** Bloquea el scroll del documento mientras `locked` es true. */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [locked]);
}
