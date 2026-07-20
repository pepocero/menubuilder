import { SignJWT, jwtVerify } from 'jose';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000;

const encoder = new TextEncoder();

function getJwtSecret(secret: string): Uint8Array {
  return encoder.encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );

  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  return `${saltB64}:${hashB64}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(':');
  if (!saltB64 || !hashB64) return false;

  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const expectedHash = Uint8Array.from(atob(hashB64), (c) => c.charCodeAt(0));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );

  const computed = new Uint8Array(hashBuffer);
  if (computed.length !== expectedHash.length) return false;

  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed[i] ^ expectedHash[i];
  }
  return diff === 0;
}

export async function hashToken(token: string): Promise<string> {
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

export async function createAccessToken(
  userId: string,
  email: string,
  secret: string,
): Promise<string> {
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(getJwtSecret(secret));
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<{ sub: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(secret));
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      return null;
    }
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export function createRefreshToken(): string {
  return crypto.randomUUID() + crypto.randomUUID();
}

export function getRefreshExpiry(): string {
  const date = new Date();
  date.setDate(date.getDate() + REFRESH_TOKEN_DAYS);
  return date.toISOString();
}

export function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get('Cookie');
  if (!header) return {};

  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (key) acc[key] = rest.join('=');
    return acc;
  }, {});
}

function cookieOptions(maxAge: number, secure: boolean): string {
  const parts = [
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function buildAuthCookies(
  accessToken: string,
  refreshToken: string,
  secure: boolean,
): string[] {
  return [
    `access_token=${accessToken}; ${cookieOptions(15 * 60, secure)}`,
    `refresh_token=${refreshToken}; ${cookieOptions(30 * 24 * 60 * 60, secure)}`,
  ];
}

export function buildClearAuthCookies(secure: boolean): string[] {
  return [
    `access_token=; ${cookieOptions(0, secure)}`,
    `refresh_token=; ${cookieOptions(0, secure)}`,
  ];
}

export function isSecureRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.protocol === 'https:';
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 8;
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

const authAttempts = new Map<string, { count: number; resetAt: number }>();
const AUTH_RATE_LIMIT = 20;
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;

export function checkAuthRateLimit(request: Request): boolean {
  const ip = getClientIp(request);
  const now = Date.now();
  const entry = authAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    authAttempts.set(ip, { count: 1, resetAt: now + AUTH_RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= AUTH_RATE_LIMIT) {
    return false;
  }

  entry.count += 1;
  return true;
}
