import {
  buildAuthCookies,
  checkAuthRateLimit,
  createAccessToken,
  createRefreshToken,
  getRefreshExpiry,
  hashPassword,
  hashToken,
  isSecureRequest,
  isValidEmail,
  isValidPassword,
} from '../../lib/auth';
import { createUser, findUserByEmail, storeRefreshToken } from '../../lib/db';
import { errorResponse, jsonResponse, parseJson } from '../../lib/types';

interface RegisterBody {
  email?: string;
  password?: string;
  name?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!checkAuthRateLimit(request)) {
    return errorResponse('Demasiados intentos. Inténtalo más tarde.', 429);
  }

  if (!env.JWT_SECRET) {
    return errorResponse('Servidor no configurado', 500);
  }

  const body = await parseJson<RegisterBody>(request);
  if (!body?.email || !body?.password) {
    return errorResponse('Email y contraseña requeridos');
  }

  if (!isValidEmail(body.email)) {
    return errorResponse('Email inválido');
  }

  if (!isValidPassword(body.password)) {
    return errorResponse('La contraseña debe tener al menos 8 caracteres');
  }

  const existing = await findUserByEmail(env.DB, body.email);
  if (existing) {
    return errorResponse('El email ya está registrado', 409);
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(body.password);
  await createUser(env.DB, userId, body.email, passwordHash, body.name?.trim() || null);

  const accessToken = await createAccessToken(userId, body.email.toLowerCase(), env.JWT_SECRET);
  const refreshToken = createRefreshToken();
  const refreshHash = await hashToken(refreshToken);

  await storeRefreshToken(
    env.DB,
    crypto.randomUUID(),
    userId,
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
        id: userId,
        email: body.email.toLowerCase(),
        name: body.name?.trim() || null,
      },
    },
    201,
    headers,
  );
};
