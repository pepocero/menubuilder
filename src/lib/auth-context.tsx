import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ApiError,
  login as apiLogin,
  logout as apiLogout,
  refreshSession,
  register as apiRegister,
  type User,
} from '@/lib/api';
import { isPublicMenuPath } from '@/lib/public-boot';
import { isSystemAdminEmail, isSystemAdminRole } from '@shared/roles';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isSystemAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => !isPublicMenuPath());

  const bootstrap = useCallback(async () => {
    // Cartas públicas (/p/…): no llamar a refresh. Evita saturar /api/auth
    // cuando muchas personas escanean el QR a la vez.
    if (isPublicMenuPath()) {
      setUser(null);
      setLoading(false);
      return;
    }

    const timeoutMs = 10000;
    try {
      const result = await Promise.race([
        refreshSession(),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new ApiError('Tiempo de espera de sesión', 0)), timeoutMs);
        }),
      ]);
      setUser(result.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (email: string, password: string) => {
    const { user: loggedIn } = await apiLogin(email, password);
    setUser(loggedIn);
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const { user: registered } = await apiRegister(email, password, name);
    setUser(registered);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isSystemAdmin:
        isSystemAdminRole(user?.role) ||
        (!!user?.email && isSystemAdminEmail(user.email)),
      login,
      register,
      logout,
    }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
