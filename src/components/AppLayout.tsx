import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';

export function AppLayout() {
  const { user, logout, isSystemAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-layout">
      <header className="app-header">
        <Link to="/" className="logo" onClick={() => setMenuOpen(false)}>
          MenuBuilder
        </Link>
        <button
          type="button"
          className="app-nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="app-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? 'Cerrar' : 'Menú'}
        </button>
        <nav id="app-nav" className={`app-nav${menuOpen ? ' app-nav--open' : ''}`}>
          <Link to="/dashboard" onClick={() => setMenuOpen(false)}>
            Mis menús
          </Link>
          <Link to="/templates" onClick={() => setMenuOpen(false)}>
            Plantillas
          </Link>
          <Link to="/qrs" onClick={() => setMenuOpen(false)}>
            Mis QR
          </Link>
          {isSystemAdmin && (
            <Link to="/admin/users" onClick={() => setMenuOpen(false)} className="app-nav-admin">
              Administración
            </Link>
          )}
          {user && <span className="user-email">{user.email}</span>}
          <button type="button" onClick={() => logout()} className="btn-secondary">
            Salir
          </button>
        </nav>
      </header>
    </div>
  );
}
