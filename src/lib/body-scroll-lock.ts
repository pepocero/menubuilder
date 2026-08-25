/**
 * Bloqueo de scroll del documento con contador.
 * Evita el fallo clásico de anidar `body.style.overflow = 'hidden'`
 * (p. ej. hoja del editor + modal OCR) y dejar Mis Menús sin poder hacer scroll.
 */

let lockCount = 0;
let savedBodyOverflow = '';
let savedHtmlOverflow = '';

function applyLock() {
  if (typeof document === 'undefined') return;
  savedBodyOverflow = document.body.style.overflow;
  savedHtmlOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
}

function applyUnlock() {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = savedBodyOverflow;
  document.documentElement.style.overflow = savedHtmlOverflow;
  savedBodyOverflow = '';
  savedHtmlOverflow = '';
}

export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) applyLock();
  lockCount += 1;
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount === 0) applyUnlock();
}

/** Fuerza la liberación (p. ej. al entrar en Mis Menús tras el botón atrás). */
export function resetBodyScrollLock(): void {
  lockCount = 0;
  if (typeof document === 'undefined') return;
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  savedBodyOverflow = '';
  savedHtmlOverflow = '';
}

export function getBodyScrollLockCount(): number {
  return lockCount;
}
