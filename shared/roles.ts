/**
 * Jerarquía de roles del sistema (multitenant de app + superadmin global).
 * El rol se resuelve por email allowlist; no depende de una columna en D1 todavía.
 * Más adelante se podrá ampliar con roles en BD (p. ej. tenant_admin).
 */

export type UserRole = 'system_admin' | 'user';

/** Rango numérico para comparar privilegios (mayor = más poder). */
export const ROLE_RANK: Record<UserRole, number> = {
  system_admin: 100,
  user: 1,
};

/** Administradores globales del sistema (acceso total). */
export const SYSTEM_ADMIN_EMAILS = ['pepocero@gmail.com'] as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isSystemAdminEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return (SYSTEM_ADMIN_EMAILS as readonly string[]).includes(normalized);
}

export function resolveUserRole(email: string): UserRole {
  return isSystemAdminEmail(email) ? 'system_admin' : 'user';
}

export function roleAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function isSystemAdminRole(role: UserRole | null | undefined): boolean {
  return role === 'system_admin';
}

export function roleLabel(role: UserRole): string {
  if (role === 'system_admin') return 'Administrador del sistema';
  return 'Usuario';
}
