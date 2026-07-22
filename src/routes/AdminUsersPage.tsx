import { useCallback, useEffect, useState } from 'react';
import { ApiError, listAdminUsers, type AdminUserSummary } from '@/lib/api';
import { AppLayout } from '@/components/AppLayout';

function formatDate(value: string): string {
  const date = new Date(value.includes('T') ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listAdminUsers();
      setUsers(result.users);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  return (
    <div className="admin-page">
      <AppLayout />
      <main className="dashboard-main admin-main">
        <div className="dashboard-header">
          <div>
            <h1>Administración</h1>
            <p className="admin-subtitle">Usuarios registrados en el sistema</p>
          </div>
          <button type="button" className="btn-secondary" onClick={() => void loadUsers()} disabled={loading}>
            Actualizar
          </button>
        </div>

        {loading && <p>Cargando usuarios…</p>}
        {error && <div className="error-banner">{error}</div>}

        {!loading && !error && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Alta</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No hay usuarios registrados.</td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{u.name?.trim() || '—'}</td>
                      <td>
                        <span
                          className={
                            u.role === 'system_admin'
                              ? 'admin-role-badge admin-role-badge--system'
                              : 'admin-role-badge'
                          }
                        >
                          {u.role_label}
                        </span>
                      </td>
                      <td>{formatDate(u.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <p className="admin-count">{users.length} usuario{users.length === 1 ? '' : 's'}</p>
          </div>
        )}
      </main>
    </div>
  );
}
