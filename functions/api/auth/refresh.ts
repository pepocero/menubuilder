import {
  buildAuthCookies,
  createAccessToken,
  createRefreshToken,
  getRefreshExpiry,
  hashToken,
  isSecureRequest,
  parseCookies,
} from '../../lib/auth';
import { findRefreshToken, findUserById, revokeRefreshToken, storeRefreshToken } from '../../lib/db';
import { errorResponse, jsonResponse } from '../../lib/types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!env.JWT_SECRET) {
    return errorResponse('Servidor no configurado', 500);
  }

  const cookies = parseCookies(request);
  const refreshToken = cookies.refresh_token;
  if (!refreshToken) {
    return errorResponse('Sesión expirada', 401);
  }

  const refreshHash = await hashToken(refreshToken);
  const stored = await findRefreshToken(env.DB, refreshHash);

  if (!stored || stored.revoked === 1) {
    return errorResponse('Sesión inválida', 401);
  }

  if (new Date(stored.expires_at) < new Date()) {
    await revokeRefreshToken(env.DB, refreshHash);
    return errorResponse('Sesión expirada', 401);
  }

  const user = await findUserById(env.DB, stored.user_id);
  if (!user) {
    return errorResponse('Usuario no encontrado', 401);
  }

  await revokeRefreshToken(env.DB, refreshHash);

  const newAccessToken = await createAccessToken(user.id, user.email, env.JWT_SECRET);
  const newRefreshToken = createRefreshToken();
  const newRefreshHash = await hashToken(newRefreshToken);

  await storeRefreshToken(
    env.DB,
    crypto.randomUUID(),
    user.id,
    newRefreshHash,
    getRefreshExpiry(),
  );

  const secure = isSecureRequest(request);
  const headers = new Headers();
  for (const cookie of buildAuthCookies(newAccessToken, newRefreshToken, secure)) {
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
