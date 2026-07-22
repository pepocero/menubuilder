/**
 * Proveedores de OCR por visión.
 * Para añadir uno nuevo:
 * 1. Añade el id en MenuOcrProviderId y en MENU_OCR_PROVIDER_OPTIONS (si es seleccionable).
 * 2. Implementa el extractor en functions/lib/vision-ocr.ts y regístralo en OCR_EXTRACTORS.
 * 3. Añade secretos/bindings en Env si hace falta.
 */

/** Motores reales que pueden ejecutar el OCR. */
export type MenuOcrProviderId = 'openai' | 'workers-ai';
// Futuro: | 'gemini' | 'anthropic' | …

/**
 * Preferencia del usuario en el modal.
 * `auto` prueba proveedores en orden y hace fallback si hay error de créditos/cuota.
 */
export type MenuOcrProviderChoice = 'auto' | MenuOcrProviderId;

export interface MenuOcrProviderOption {
  id: MenuOcrProviderChoice;
  label: string;
  hint: string;
}

export const DEFAULT_OCR_PROVIDER: MenuOcrProviderChoice = 'auto';

export const MENU_OCR_PROVIDER_OPTIONS: MenuOcrProviderOption[] = [
  {
    id: 'auto',
    label: 'Automático',
    hint: 'Usa OpenAI si está disponible; si falla por créditos o cuota, prueba Workers AI.',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    hint: 'Mejor calidad (gpt-4o-mini / gpt-4o). Requiere OPENAI_API_KEY.',
  },
  {
    id: 'workers-ai',
    label: 'Workers AI',
    hint: 'Fallback en Cloudflare (sin gastar créditos de OpenAI). Calidad variable.',
  },
];

export function parseOcrProviderChoice(raw: unknown): MenuOcrProviderChoice {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (value === 'auto' || value === 'openai' || value === 'workers-ai') {
    return value;
  }
  return DEFAULT_OCR_PROVIDER;
}

/** Errores en los que tiene sentido probar el siguiente proveedor en modo auto. */
export function isOcrProviderRetryableError(message: string): boolean {
  return /quota|billing|insufficient|credit|rate.?limit|429|402|401|403|no configurad|api key|incorrect api|exceeded/i.test(
    message,
  );
}
