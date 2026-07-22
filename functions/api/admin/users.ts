import { listAllUsers } from '../../lib/db';
import { requireSystemAdmin } from '../../lib/middleware';
import { errorResponse, jsonResponse } from '../../lib/types';
import { resolveUserRole, roleLabel } from '../../../shared/roles';

/**
 * GET /api/admin/users
 * Solo system_admin: listado de todos los usuarios registrados.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = await requireSystemAdmin(context.request, context.env);
  if ('response' in auth) return auth.response;

  try {
    const rows = await listAllUsers(context.env.DB);
    return jsonResponse({
      users: rows.map((row) => {
        const role = resolveUserRole(row.email);
        return {
          id: row.id,
          email: row.email,
          name: row.name,
          created_at: row.created_at,
          role,
          role_label: roleLabel(role),
        };
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudieron listar los usuarios';
    return errorResponse(message, 500);
  }
};
