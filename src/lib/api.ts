export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Evita varios /api/auth/refresh en paralelo cuando caduca el access token. */
let refreshInFlight: Promise<boolean> | null = null;

function isAuthPath(path: string): boolean {
  return path.startsWith('/api/auth/');
}

async function tryRefreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      // refresh_token es HttpOnly: va en credentials; no se puede leer con document.cookie.
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function buildFetchInit(options: RequestInit = {}): RequestInit {
  return {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  };
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, buildFetchInit(options));
  } catch {
    throw new ApiError(
      'No se pudo conectar con la API. Comprueba que npm run dev esté activo y la API en el puerto 8788.',
      0,
    );
  }

  // Access token ~15 min: renovar con refresh y reintentar una vez.
  if (response.status === 401 && !retried && !isAuthPath(path)) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return request<T>(path, options, true);
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      (data as { error?: string }).error ?? 'Error de servidor',
      response.status,
    );
  }

  return data as T;
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'DELETE',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  upload<T>(path: string, file: File): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    return request<T>(path, { method: 'POST', body: formData });
  },

  /** Subida con progreso real (XMLHttpRequest). `onProgress` recibe 0–100. */
  uploadWithProgress<T>(
    path: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<T> {
    const send = (retried: boolean) =>
      new Promise<T>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);

        xhr.open('POST', path);
        xhr.withCredentials = true;

        xhr.upload.onprogress = (event) => {
          if (!onProgress) return;
          if (event.lengthComputable && event.total > 0) {
            onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
          } else {
            onProgress(0);
          }
        };

        xhr.onload = () => {
          void (async () => {
            if (xhr.status === 401 && !retried && !isAuthPath(path)) {
              const refreshed = await tryRefreshSession();
              if (refreshed) {
                try {
                  resolve(await send(true));
                } catch (err) {
                  reject(err);
                }
                return;
              }
            }

            let data: unknown = {};
            try {
              data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
            } catch {
              data = {};
            }

            if (xhr.status >= 200 && xhr.status < 300) {
              onProgress?.(100);
              resolve(data as T);
              return;
            }

            reject(
              new ApiError(
                (data as { error?: string }).error ?? 'Error de servidor',
                xhr.status,
              ),
            );
          })();
        };

        xhr.onerror = () => {
          reject(
            new ApiError(
              'No se pudo conectar con la API. Comprueba que npm run dev esté activo y la API en el puerto 8788.',
              0,
            ),
          );
        };

        xhr.onabort = () => {
          reject(new ApiError('Subida cancelada', 0));
        };

        xhr.send(formData);
      });

    return send(false);
  },
};

export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthResponse {
  user: User;
}

export async function register(
  email: string,
  password: string,
  name?: string,
): Promise<AuthResponse> {
  return api.post('/api/auth/register', { email, password, name });
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return api.post('/api/auth/login', { email, password });
}

export async function refreshSession(): Promise<AuthResponse> {
  // No usar request() aquí: evita bucles de refresh-on-401.
  let response: Response;
  try {
    response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    throw new ApiError('No se pudo conectar con la API.', 0);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      (data as { error?: string }).error ?? 'Sesión expirada',
      response.status,
    );
  }
  return data as AuthResponse;
}

export async function logout(): Promise<void> {
  await api.post('/api/auth/logout');
}

export interface MenuSummary {
  id: string;
  title: string;
  template_id: string | null;
  thumbnail_url: string | null;
  is_public: boolean;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenuDetail extends Omit<MenuSummary, 'canvas_data'> {
  canvas_data: import('@/types/canvas').CanvasData;
}

export async function listMenus(): Promise<{ menus: MenuSummary[] }> {
  return api.get('/api/menus');
}

export async function getMenu(id: string): Promise<{ menu: MenuDetail & { canvas_data: import('@/types/canvas').CanvasData } }> {
  return api.get(`/api/menus/${id}`);
}

export async function createMenu(data: {
  title?: string;
  template_id?: string;
}): Promise<{ menu: { id: string; title: string; canvas_data: import('@/types/canvas').CanvasData } }> {
  return api.post('/api/menus', data);
}

export async function updateMenu(
  id: string,
  data: {
    title?: string;
    canvas_data?: import('@/types/canvas').CanvasData;
    thumbnail_url?: string | null;
  },
): Promise<{ menu: { id: string; title: string; canvas_data: import('@/types/canvas').CanvasData } }> {
  return api.put(`/api/menus/${id}`, data);
}

export async function deleteMenu(id: string): Promise<void> {
  await api.delete(`/api/menus/${id}`);
}

export async function duplicateMenu(id: string): Promise<{ menu: { id: string; title: string } }> {
  return api.post(`/api/menus/${id}/duplicate`);
}

export async function publishMenu(id: string): Promise<{ public_slug: string; public_url: string }> {
  return api.post(`/api/menus/${id}/publish`);
}

export async function unpublishMenu(id: string): Promise<{ ok: boolean }> {
  return api.post(`/api/menus/${id}/unpublish`);
}

export interface PublishedQr {
  id: string;
  title: string;
  public_slug: string;
  public_url: string;
  thumbnail_url: string | null;
  updated_at: string;
}

export async function listMyQrs(): Promise<{ menus: PublishedQr[] }> {
  return api.get('/api/qrs');
}

export async function getPublicMenu(slug: string): Promise<{
  menu: {
    title: string;
    canvas_data: import('@/types/canvas').CanvasData;
    menu_document: import('@shared/menu-document/types').MenuDocument | null;
    export_png_url: string | null;
    thumbnail_url: string | null;
    updated_at: string;
    public_slug: string;
  };
}> {
  return api.get(`/api/public/menus/${encodeURIComponent(slug)}`);
}

export interface TemplateSummary {
  id: string;
  name: string;
  category: string | null;
  thumbnail_url: string | null;
  is_premium: boolean;
  canvas_data?: import('@/types/canvas').CanvasData;
}

export async function listTemplates(): Promise<{ templates: TemplateSummary[] }> {
  return api.get('/api/templates');
}

export async function getTemplate(id: string): Promise<{ template: TemplateSummary & { canvas_data: import('@/types/canvas').CanvasData } }> {
  return api.get(`/api/templates/${id}`);
}

export async function uploadAsset(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ asset: { id: string; url: string } }> {
  if (onProgress) {
    return api.uploadWithProgress('/api/assets', file, onProgress);
  }
  return api.upload('/api/assets', file);
}

/** OCR de carta por visión (servidor: OpenAI, Workers AI u otros). */
export async function recognizeMenuWithVision(
  image: Blob,
  options?: {
    provider?: import('@shared/ocr-providers').MenuOcrProviderChoice;
    onProgress?: (percent: number) => void;
  },
): Promise<{ menu: import('@shared/menu-ocr').MenuOcrResult; provider?: string }> {
  const onProgress = options?.onProgress;
  const provider = options?.provider ?? 'workers-ai';

  const file =
    image instanceof File
      ? image
      : new File([image], 'menu-ocr.jpg', { type: image.type || 'image/jpeg' });

  onProgress?.(8);
  let tick = 8;
  const timer = window.setInterval(() => {
    tick = Math.min(92, tick + 4);
    onProgress?.(tick);
  }, 400);

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('provider', provider);

    const result = await request<{
      menu: import('@shared/menu-ocr').MenuOcrResult;
      provider?: string;
    }>('/api/ocr/menu', {
      method: 'POST',
      body: formData,
    });
    onProgress?.(100);
    return result;
  } finally {
    window.clearInterval(timer);
  }
}

export interface AssetSummary {
  id: string;
  type: string | null;
  url: string | null;
  r2_key: string;
  source: string | null;
  created_at: string;
}

export async function listAssets(): Promise<{ assets: AssetSummary[] }> {
  return api.get('/api/assets');
}

export async function importStockImage(data: {
  stockImageId: string;
  fullUrl: string;
  provider?: string;
}): Promise<{ asset: { id: string; url: string } }> {
  return api.post('/api/assets/import-stock', data);
}

/** Borra de R2+D1. Con force=true elimina aunque esté referenciado en menús. */
export async function deleteAsset(data: {
  id?: string;
  url?: string;
  exclude_menu_id?: string;
  force?: boolean;
}): Promise<{ deleted: boolean; kept?: boolean; reason?: string; url?: string | null; id?: string }> {
  return api.delete('/api/assets', data);
}
