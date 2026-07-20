import { isPublicApiPath, requireAuth } from './lib/middleware';

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (!url.pathname.startsWith('/api/')) {
    return next();
  }

  if (isPublicApiPath(url.pathname, request.method)) {
    return next();
  }

  const auth = await requireAuth(request, env);
  if ('response' in auth) {
    return auth.response;
  }

  context.data = {
    ...context.data,
    userId: auth.user.userId,
    email: auth.user.email,
  };

  return next();
};
