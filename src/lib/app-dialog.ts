export type AppDialogVariant = 'info' | 'success' | 'warning' | 'danger' | 'question';

export interface AppDialogRequest {
  title: string;
  message: string;
  variant?: AppDialogVariant;
  confirmText?: string;
  cancelText?: string;
  /** Si false, solo botón de aceptar (alert). Por defecto true = confirm. */
  showCancel?: boolean;
}

export interface AppDialogState extends AppDialogRequest {
  id: number;
  resolve: (value: boolean) => void;
}

type Listener = (state: AppDialogState | null) => void;

let nextId = 1;
let current: AppDialogState | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(current);
}

export function subscribeAppDialog(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

export function getAppDialogState(): AppDialogState | null {
  return current;
}

function openDialog(request: AppDialogRequest): Promise<boolean> {
  return new Promise((resolve) => {
    if (current) {
      current.resolve(false);
    }
    current = {
      id: nextId++,
      variant: 'question',
      confirmText: 'Aceptar',
      cancelText: 'Cancelar',
      showCancel: true,
      ...request,
      resolve,
    };
    emit();
  });
}

export function closeAppDialog(result: boolean) {
  if (!current) return;
  const { resolve } = current;
  current = null;
  emit();
  resolve(result);
}

/** Confirmación estilo modal (reemplazo de `window.confirm`). */
export function appConfirm(
  message: string,
  options?: Omit<AppDialogRequest, 'message' | 'showCancel'>,
): Promise<boolean> {
  return openDialog({
    title: options?.title ?? 'Confirmar',
    message,
    variant: options?.variant ?? 'question',
    confirmText: options?.confirmText ?? 'Aceptar',
    cancelText: options?.cancelText ?? 'Cancelar',
    showCancel: true,
  });
}

/** Aviso estilo modal (reemplazo de `window.alert`). */
export async function appAlert(
  message: string,
  options?: Omit<AppDialogRequest, 'message' | 'showCancel' | 'cancelText'>,
): Promise<void> {
  await openDialog({
    title: options?.title ?? 'Aviso',
    message,
    variant: options?.variant ?? 'info',
    confirmText: options?.confirmText ?? 'Entendido',
    showCancel: false,
  });
}
