import {
  buildAuthCookies,
  checkAuthRateLimit,
  createAccessToken,
  createRefreshToken,
  getRefreshExpiry,
  hashToken,
  isSecureRequest,
  isValidEmail,
  isValidPassword,
  verifyPassword,
} from '../../lib/auth';
import { findUserByEmail, storeRefreshToken } from '../../lib/db';
import { errorResponse, jsonResponse, parseJson } from '../../lib/types';

interface LoginBody {
  email?: string;
  password?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkAuthRateLimit(request)) {
    return errorResponse('Demasiados intentos. Inténtalo más tarde.', 429);
  }

  if (!env.JWT_SECRET) {
    return errorResponse('Servidor no configurado', 500);
  }

  const body = await parseJson<LoginBody>(request);
  if (!body?.email || !body?.password) {
    return errorResponse('Email y contraseña requeridos');
  }

  if (!isValidEmail(body.email) || !isValidPassword(body.password)) {
    return errorResponse('Credenciales inválidas', 401);
  }

  const user = await findUserByEmail(env.DB, body.email);
  if (!user || !(await verifyPassword(body.password, user.password_hash))) {
    return errorResponse('Credenciales inválidas', 401);
  }

  const accessToken = await createAccessToken(user.id, user.email, env.JWT_SECRET);
  const refreshToken = createRefreshToken();
  const refreshHash = await hashToken(refreshToken);

  await storeRefreshToken(
    env.DB,
    crypto.randomUUID(),
    user.id,
    refreshHash,
    getRefreshExpiry(),
  );

  const secure = isSecureRequest(request);
  const headers = new Headers();
  for (const cookie of buildAuthCookies(accessToken, refreshToken, secure)) {
    headers.append('Set-Cookie', cookie);
  }

  return jsonResponse(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    },
    200,
    headers,
  );
};
