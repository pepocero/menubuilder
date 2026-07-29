import { useEffect, useState } from 'react';
import {
  closeAppDialog,
  subscribeAppDialog,
  type AppDialogState,
  type AppDialogVariant,
} from '@/lib/app-dialog';

function DialogIcon({ variant }: { variant: AppDialogVariant }) {
  if (variant === 'success') {
    return (
      <svg viewBox="0 0 52 52" width="52" height="52" aria-hidden="true">
        <circle cx="26" cy="26" r="25" fill="none" stroke="currentColor" strokeWidth="2" />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          d="M14 27l8 8 16-16"
        />
      </svg>
    );
  }
  if (variant === 'danger' || variant === 'warning') {
    return (
      <svg viewBox="0 0 52 52" width="52" height="52" aria-hidden="true">
        <circle cx="26" cy="26" r="25" fill="none" stroke="currentColor" strokeWidth="2" />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          d="M26 14v16M26 36h.01"
        />
      </svg>
    );
  }
  if (variant === 'question') {
    return (
      <svg viewBox="0 0 52 52" width="52" height="52" aria-hidden="true">
        <circle cx="26" cy="26" r="25" fill="none" stroke="currentColor" strokeWidth="2" />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          d="M20 20a6 6 0 1 1 8 5.5c-.9.5-2 1.5-2 3v1.5M26 36h.01"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 52 52" width="52" height="52" aria-hidden="true">
      <circle cx="26" cy="26" r="25" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        d="M26 16v14M26 36h.01"
      />
    </svg>
  );
}

export function AppDialogHost() {
  const [state, setState] = useState<AppDialogState | null>(null);

  useEffect(() => subscribeAppDialog(setState), []);

  useEffect(() => {
    if (!state) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAppDialog(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        closeAppDialog(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state]);

  if (!state) return null;

  const variant = state.variant ?? 'question';
  const showCancel = state.showCancel !== false;

  return (
    <div
      className="app-dialog-overlay"
      role="presentation"
      onClick={() => closeAppDialog(false)}
    >
      <div
        className={`app-dialog app-dialog--${variant}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`app-dialog-title-${state.id}`}
        aria-describedby={`app-dialog-msg-${state.id}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="app-dialog-icon" aria-hidden="true">
          <DialogIcon variant={variant} />
        </div>
        <h2 id={`app-dialog-title-${state.id}`}>{state.title}</h2>
        <p id={`app-dialog-msg-${state.id}`} className="app-dialog-message">
          {state.message}
        </p>
        <div className="app-dialog-actions">
          {showCancel && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => closeAppDialog(false)}
            >
              {state.cancelText ?? 'Cancelar'}
            </button>
          )}
          <button
            type="button"
            className={variant === 'danger' ? 'danger-btn' : 'btn-primary'}
            autoFocus
            onClick={() => closeAppDialog(true)}
          >
            {state.confirmText ?? 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  );
}
