import type { MenuOcrResult, MenuOcrSection } from '../../shared/menu-ocr';
import {
  MENU_OCR_JSON_SCHEMA,
  MENU_OCR_SYSTEM_PROMPT,
  MENU_OCR_USER_PROMPT,
  parseMenuOcrBox,
} from '../../shared/menu-ocr';
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

/** Gemma 4: visión + OCR estructurado (sin licencia Meta / UE). */
const WORKERS_AI_VISION_MODEL = '@cf/google/gemma-4-26b-a4b-it';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function previewText(raw: string, max = 180): string {
  const oneLine = raw.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max)}…`;
}

function parseMenuOcrJson(raw: string): MenuOcrResult {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced?.[1]?.trim() ?? trimmed;
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error(`La IA no devolvió JSON de carta válido: ${previewText(raw)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText.slice(start, end + 1));
  } catch {
    throw new Error(`La IA devolvió JSON inválido: ${previewText(raw)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`JSON de carta incompleto: ${previewText(raw)}`);
  }

  const obj = parsed as Record<string, unknown>;
  // Algunos modelos envuelven el resultado.
  const root =
    obj.menu && typeof obj.menu === 'object'
      ? (obj.menu as Record<string, unknown>)
      : obj.carta && typeof obj.carta === 'object'
        ? (obj.carta as Record<string, unknown>)
        : obj;

  const sectionsRaw = root.sections ?? root.Secciones ?? root.categories;
  if (!Array.isArray(sectionsRaw)) {
    throw new Error(`JSON de carta incompleto (sin sections): ${previewText(raw)}`);
  }

  return {
    headerTitle: String(root.headerTitle ?? root.title ?? '').trim(),
    headerSubtitle: String(root.headerSubtitle ?? root.subtitle ?? '').trim(),
    headerTitleBox: parseMenuOcrBox(root.headerTitleBox ?? root.titleBox),
    headerSubtitleBox: parseMenuOcrBox(root.headerSubtitleBox ?? root.subtitleBox),
    sections: sectionsRaw.map((s, index) => {
      const section = (s ?? {}) as Record<string, unknown>;
      const column = section.column;
      const mapped: MenuOcrSection = {
        title: String(section.title ?? '').trim(),
        column:
          column === 'left' || column === 'right' || column === 'full' ? column : 'full',
        order:
          typeof section.order === 'number' && Number.isFinite(section.order)
            ? section.order
            : index + 1,
        body: String(section.body ?? section.content ?? section.text ?? '').trim(),
        titleBox: parseMenuOcrBox(section.titleBox ?? section.title_bbox),
        bodyBox: parseMenuOcrBox(section.bodyBox ?? section.body_bbox),
        box: parseMenuOcrBox(section.box ?? section.bbox ?? section.bounds),
      };
      return mapped;
    }),
    provider: typeof root.provider === 'string' ? root.provider : undefined,
  };
}

function contentPartsToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const part of content) {
    if (typeof part === 'string') {
      parts.push(part);
      continue;
    }
    if (!part || typeof part !== 'object') continue;
    const p = part as Record<string, unknown>;
    if (typeof p.text === 'string') parts.push(p.text);
    else if (typeof p.content === 'string') parts.push(p.content);
  }
  return parts.join('');
}

/** Extrae texto útil de la respuesta heterogénea de Workers AI. */
function workersAiResponseToText(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (!raw || typeof raw !== 'object') return String(raw ?? '');

  const obj = raw as Record<string, unknown>;

  if (typeof obj.response === 'string' && obj.response.trim()) return obj.response;
  if (typeof obj.answer === 'string' && obj.answer.trim()) return obj.answer;
  if (typeof obj.result === 'string' && obj.result.trim()) return obj.result;
  if (typeof obj.text === 'string' && obj.text.trim()) return obj.text;
  if (typeof obj.output === 'string' && obj.output.trim()) return obj.output;

  const choices = obj.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === 'object') {
    const choice = choices[0] as {
      message?: { content?: unknown; reasoning?: unknown; reasoning_content?: unknown };
      text?: unknown;
      delta?: { content?: unknown };
    };
    const fromMessage = contentPartsToText(choice.message?.content);
    if (fromMessage.trim()) return fromMessage;
    const fromDelta = contentPartsToText(choice.delta?.content);
    if (fromDelta.trim()) return fromDelta;
    if (typeof choice.text === 'string' && choice.text.trim()) return choice.text;
    const reasoning =
      contentPartsToText(choice.message?.reasoning) ||
      contentPartsToText(choice.message?.reasoning_content);
    if (reasoning.trim()) return reasoning;
  }

  // Reasoning-only (Gemma thinking) como último recurso.
  const reasoningFallback =
    contentPartsToText(obj.reasoning) ||
    contentPartsToText(obj.reasoning_content) ||
    (typeof obj.response === 'string' ? obj.response : '');
  if (reasoningFallback.trim()) return reasoningFallback;

  // A veces el propio objeto ya es el JSON de carta.
  if (Array.isArray(obj.sections) || Array.isArray(obj.Secciones)) {
    return JSON.stringify(obj);
  }

  return JSON.stringify(raw);
}

/** Materializa ReadableStream / Response de Workers AI (p. ej. si stream quedó activo). */
async function materializeWorkersAiResult(raw: unknown): Promise<unknown> {
  if (raw == null || typeof raw !== 'object') return raw;

  if (typeof Response !== 'undefined' && raw instanceof Response) {
    const ct = raw.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        return await raw.json();
      } catch {
        return await raw.text();
      }
    }
    return materializeWorkersAiResult(raw.body);
  }

  if (typeof ReadableStream !== 'undefined' && raw instanceof ReadableStream) {
    const reader = raw.getReader();
    const decoder = new TextDecoder();
    let acc = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += decoder.decode(value, { stream: true });
    }
    acc += decoder.decode();

    const pieces: string[] = [];
    for (const line of acc.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const parsed: unknown = JSON.parse(payload);
        const chunk = workersAiResponseToText(parsed);
        if (chunk && chunk !== '{}' && chunk !== 'null') pieces.push(chunk);
      } catch {
        pieces.push(payload);
      }
    }
    if (pieces.length > 0) return pieces.join('');
    const trimmed = acc.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        /* ignore */
      }
    }
    return trimmed;
  }

  return raw;
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
            { type: 'text', text: MENU_OCR_USER_PROMPT },
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
  mime: string,
): Promise<MenuOcrResult> {
  if (!env.AI) throw new Error('Workers AI no está configurado');

  const b64 = arrayBufferToBase64(imageBytes);
  const dataUrl = `data:${mime || 'image/jpeg'};base64,${b64}`;
  const messages = [
    { role: 'system', content: MENU_OCR_SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: MENU_OCR_USER_PROMPT },
        { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
      ],
    },
  ];

  // Gemma 4 en Workers AI tiene thinking ON por defecto: se gasta max_tokens
  // en razonamiento y response/content llega vacío → «no devolvió contenido OCR».
  const runOptions = {
    messages,
    temperature: 0,
    stream: false,
    max_completion_tokens: 6144,
    chat_template_kwargs: { enable_thinking: false },
    response_format: {
      type: 'json_schema' as const,
      json_schema: {
        name: 'menu_ocr',
        strict: true,
        schema: MENU_OCR_JSON_SCHEMA,
      },
    },
  };

  let raw: unknown;
  try {
    raw = await env.AI.run(WORKERS_AI_VISION_MODEL, runOptions);
  } catch (err) {
    // Reintento sin response_format (algunos runtimes lo rechazan).
    try {
      raw = await env.AI.run(WORKERS_AI_VISION_MODEL, {
        messages,
        temperature: 0,
        stream: false,
        max_completion_tokens: 6144,
        chat_template_kwargs: { enable_thinking: false },
      });
    } catch (err2) {
      const detail = err2 instanceof Error ? err2.message : String(err2);
      const first = err instanceof Error ? err.message : String(err);
      throw new Error(`Workers AI falló: ${detail || first}`);
    }
  }

  raw = await materializeWorkersAiResult(raw);
  const text = workersAiResponseToText(raw);
  if (!text || text === '{}' || text === 'null') {
    throw new Error(
      `Workers AI no devolvió contenido OCR (${previewText(JSON.stringify(raw ?? null), 120)})`,
    );
  }

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

/** Orden de intento en modo auto: Workers AI primero, OpenAI como refuerzo. */
function autoProviderChain(env: Env): MenuOcrProviderId[] {
  const chain: MenuOcrProviderId[] = [];
  if (providerAvailable(env, 'workers-ai')) chain.push('workers-ai');
  if (providerAvailable(env, 'openai')) chain.push('openai');
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
  providerChoice: MenuOcrProviderChoice | string = 'workers-ai',
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
