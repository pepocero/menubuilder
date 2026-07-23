import {
  parseCookies,
  verifyAccessToken,
} from './auth';
import type { AuthUser, Env } from './types';
import { errorResponse } from './types';
import { isSystemAdminEmail, resolveUserRole } from '../../shared/roles';

export async function getAuthUser(request: Request, env: Env): Promise<AuthUser | null> {
  if (!env.JWT_SECRET) return null;

  const cookies = parseCookies(request);
  const accessToken = cookies.access_token;
  if (!accessToken) return null;

  const payload = await verifyAccessToken(accessToken, env.JWT_SECRET);
  if (!payload) return null;

  return {
    userId: payload.sub,
    email: payload.email,
    role: resolveUserRole(payload.email),
  };
}

export async function requireAuth(
  request: Request,
  env: Env,
): Promise<{ user: AuthUser } | { response: Response }> {
  const user = await getAuthUser(request, env);
  if (!user) {
    return { response: errorResponse('No autenticado', 401) };
  }
  return { user };
}

/** Exige administrador global del sistema (p. ej. pepocero@gmail.com). */
export async function requireSystemAdmin(
  request: Request,
  env: Env,
): Promise<{ user: AuthUser } | { response: Response }> {
  const auth = await requireAuth(request, env);
  if ('response' in auth) return auth;
  if (!isSystemAdminEmail(auth.user.email)) {
    return { response: errorResponse('Acceso denegado', 403) };
  }
  return auth;
}

export function isPublicApiPath(pathname: string, method: string): boolean {
  if (pathname.startsWith('/api/auth/')) return true;
  if (pathname === '/api/templates' && method === 'GET') return true;
  if (pathname.startsWith('/api/templates/') && method === 'GET') return true;
  if (
    method === 'GET' &&
    (pathname === '/api/assets/file' || pathname.startsWith('/api/assets/file/'))
  ) {
    return true;
  }
  if (pathname.startsWith('/api/public/') && method === 'GET') return true;
  return false;
}
