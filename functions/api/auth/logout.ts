import {
  buildClearAuthCookies,
  hashToken,
  isSecureRequest,
  parseCookies,
} from '../../lib/auth';
import { revokeRefreshToken } from '../../lib/db';
import { jsonResponse } from '../../lib/types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const cookies = parseCookies(request);
  const refreshToken = cookies.refresh_token;

  if (refreshToken) {
    const refreshHash = await hashToken(refreshToken);
    await revokeRefreshToken(env.DB, refreshHash);
  }

  const secure = isSecureRequest(request);
  const headers = new Headers();
  for (const cookie of buildClearAuthCookies(secure)) {
    headers.append('Set-Cookie', cookie);
  }

  return jsonResponse({ ok: true }, 200, headers);
};
