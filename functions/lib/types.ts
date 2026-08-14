export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  JWT_SECRET: string;
  STOCK_PROVIDER?: string;
  PIXABAY_API_KEY?: string;
  PEXELS_API_KEY?: string;
  /** OCR por visión (recomendado). gpt-4o-mini por defecto. */
  OPENAI_API_KEY?: string;
  OPENAI_OCR_MODEL?: string;
  /** Fallback OCR visión sin OpenAI. */
  AI?: Ai;
}

export interface AuthUser {
  userId: string;
  email: string;
  role: import('../../shared/roles').UserRole;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  created_at: string;
}

export interface MenuRow {
  id: string;
  user_id: string;
  title: string;
  template_id: string | null;
  canvas_data: string;
  thumbnail_url: string | null;
  editor_kind: 'canvas' | 'mobile';
  mobile_document: string | null;
  menu_document: string | null;
  export_png_url: string | null;
  is_public: number;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateRow {
  id: string;
  name: string;
  category: string | null;
  canvas_data: string;
  thumbnail_url: string | null;
  is_premium: number;
  user_id: string | null;
  is_public: number;
  created_at: string;
  updated_at: string;
  editor_kind: 'canvas' | 'mobile';
  mobile_document: string | null;
  author_name?: string | null;
}

export function isTemplateVisible(template: TemplateRow, viewerUserId?: string | null): boolean {
  if (!template.user_id) return true;
  if (template.is_public === 1) return true;
  if (viewerUserId && template.user_id === viewerUserId) return true;
  return false;
}

export interface AssetRow {
  id: string;
  user_id: string;
  type: string | null;
  r2_key: string;
  url: string | null;
  source: string | null;
  created_at: string;
}

export function jsonResponse(data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (extraHeaders) {
    const incoming = new Headers(extraHeaders);
    incoming.forEach((value, key) => headers.append(key, value));
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

export async function parseJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
