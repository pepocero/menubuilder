import { resolveUserRole, type UserRole } from '../../shared/roles';

/** Usuario público para respuestas de auth / admin (sin secretos). */
export function toPublicAuthUser(user: {
  id: string;
  email: string;
  name: string | null;
}): {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
} {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: resolveUserRole(user.email),
  };
}
