import type { MenuOcrResult } from '../../shared/menu-ocr';
import { MENU_OCR_JSON_SCHEMA, MENU_OCR_SYSTEM_PROMPT } from '../../shared/menu-ocr';
import {
  isOcrProviderRetryableError,
  parseOcrProviderChoice,
  type MenuOcrProviderChoice,
  type MenuOcrProviderId,
} from '../../shared/ocr-providers';
import type { Env } from './types';

type OcrExtractor = (
  env: Env,
  imageBytes: ArrayBuffer,
  mime: string,
) => Promise<MenuOcrResult>;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function parseMenuOcrJson(raw: string): MenuOcrResult {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced?.[1]?.trim() ?? trimmed;
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('La IA no devolvió JSON de carta válido');
  }
  const parsed = JSON.parse(jsonText.slice(start, end + 1)) as MenuOcrResult;
  if (!parsed || !Array.isArray(parsed.sections)) {
    throw new Error('JSON de carta incompleto');
  }
  return {
    headerTitle: String(parsed.headerTitle ?? '').trim(),
    headerSubtitle: String(parsed.headerSubtitle ?? '').trim(),
    sections: parsed.sections.map((s, index) => ({
      title: String(s.title ?? '').trim(),
      column:
        s.column === 'left' || s.column === 'right' || s.column === 'full'
          ? s.column
          : 'full',
      order: typeof s.order === 'number' && Number.isFinite(s.order) ? s.order : index + 1,
      body: String(s.body ?? '').trim(),
    })),
    provider: parsed.provider,
  };
}

async function extractWithOpenAI(
  env: Env,
  imageBytes: ArrayBuffer,
  mime: string,
): Promise<MenuOcrResult> {
  const key = env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY no configurada');

  const b64 = arrayBufferToBase64(imageBytes);
  const dataUrl = `data:${mime};base64,${b64}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_OCR_MODEL?.trim() || 'gpt-4o-mini',
      temperature: 0,
      messages: [
        { role: 'system', content: MENU_OCR_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Transcribe esta carta de menú a JSON estructurado. No omitas secciones ni columnas.',
            },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'menu_ocr',
          strict: true,
          schema: MENU_OCR_JSON_SCHEMA,
        },
      },
    }),
  });

  const payload = (await response.json()) as {
    error?: { message?: string; code?: string; type?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!response.ok) {
    const detail =
      payload.error?.message ??
      payload.error?.code ??
      payload.error?.type ??
      `OpenAI OCR falló (${response.status})`;
    throw new Error(detail);
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI no devolvió contenido OCR');

  const result = parseMenuOcrJson(content);
  result.provider = 'openai';
  return result;
}

async function extractWithWorkersAi(
  env: Env,
  imageBytes: ArrayBuffer,
): Promise<MenuOcrResult> {
  if (!env.AI) throw new Error('Workers AI no está configurado');

  const bytes = [...new Uint8Array(imageBytes)];
  const prompt = `${MENU_OCR_SYSTEM_PROMPT}

Devuelve SOLO el JSON con esta forma:
{"headerTitle":"","headerSubtitle":"","sections":[{"title":"","column":"left|right|full","order":1,"body":""}]}`;

  const raw = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
    prompt,
    image: bytes,
    max_tokens: 4096,
  });

  const text =
    typeof raw === 'string'
      ? raw
      : typeof raw === 'object' && raw && 'response' in raw
        ? String((raw as { response: unknown }).response)
        : JSON.stringify(raw);

  const result = parseMenuOcrJson(text);
  result.provider = 'workers-ai';
  return result;
}

/**
 * Registro de extractores. Al añadir un proveedor nuevo, registra aquí la función.
 */
const OCR_EXTRACTORS: Record<MenuOcrProviderId, OcrExtractor> = {
  openai: extractWithOpenAI,
  'workers-ai': extractWithWorkersAi,
};

function providerAvailable(env: Env, id: MenuOcrProviderId): boolean {
  if (id === 'openai') return !!env.OPENAI_API_KEY;
  if (id === 'workers-ai') return !!env.AI;
  return false;
}

/** Orden de intento en modo auto (prioridad → fallback). */
function autoProviderChain(env: Env): MenuOcrProviderId[] {
  const chain: MenuOcrProviderId[] = [];
  if (providerAvailable(env, 'openai')) chain.push('openai');
  if (providerAvailable(env, 'workers-ai')) chain.push('workers-ai');
  return chain;
}

async function runExtractor(
  id: MenuOcrProviderId,
  env: Env,
  imageBytes: ArrayBuffer,
  mime: string,
): Promise<MenuOcrResult> {
  if (!providerAvailable(env, id)) {
    if (id === 'openai') throw new Error('OPENAI_API_KEY no configurada');
    if (id === 'workers-ai') throw new Error('Workers AI no está configurado');
    throw new Error(`Proveedor OCR no disponible: ${id}`);
  }
  return OCR_EXTRACTORS[id](env, imageBytes, mime);
}

/** OCR de carta con visión según la preferencia del usuario. */
export async function extractMenuWithVision(
  env: Env,
  imageBytes: ArrayBuffer,
  mime: string,
  providerChoice: MenuOcrProviderChoice | string = 'auto',
): Promise<MenuOcrResult> {
  const choice = parseOcrProviderChoice(providerChoice);

  if (choice !== 'auto') {
    return runExtractor(choice, env, imageBytes, mime);
  }

  const chain = autoProviderChain(env);
  if (chain.length === 0) {
    throw new Error(
      'OCR por visión no configurado. Añade OPENAI_API_KEY y/o el binding AI de Workers AI.',
    );
  }

  let lastError: Error | null = null;
  for (let i = 0; i < chain.length; i++) {
    const id = chain[i];
    try {
      return await runExtractor(id, env, imageBytes, mime);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const hasNext = i < chain.length - 1;
      if (!hasNext || !isOcrProviderRetryableError(lastError.message)) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error('OCR por visión falló');
}
