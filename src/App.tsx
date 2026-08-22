import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth-context';
import { DocumentSeo } from '@/components/DocumentSeo';
import {
  ProtectedRoute,
  PublicOnlyRoute,
  SystemAdminRoute,
} from '@/components/ProtectedRoute';
import { LandingPage } from '@/routes/LandingPage';
import { AppDialogHost } from '@/components/ui/AppDialogHost';

const AdminUsersPage = lazy(() =>
  import('@/routes/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
);
const DashboardPage = lazy(() =>
  import('@/routes/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const DocsPage = lazy(() => import('@/routes/DocsPage').then((m) => ({ default: m.DocsPage })));
const EditorPage = lazy(() => import('@/routes/EditorPage').then((m) => ({ default: m.EditorPage })));
const LoginPage = lazy(() => import('@/routes/LoginPage').then((m) => ({ default: m.LoginPage })));
const MobileEditorPage = lazy(() =>
  import('@/routes/MobileEditorPage').then((m) => ({ default: m.MobileEditorPage })),
);
const PublicMenuPage = lazy(() =>
  import('@/routes/PublicMenuPage').then((m) => ({ default: m.PublicMenuPage })),
);
const QrsPage = lazy(() => import('@/routes/QrsPage').then((m) => ({ default: m.QrsPage })));
const RegisterPage = lazy(() =>
  import('@/routes/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);
const TemplatesPage = lazy(() =>
  import('@/routes/TemplatesPage').then((m) => ({ default: m.TemplatesPage })),
);

function RouteLoading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <p
      className="public-menu-status"
      style={{ margin: '2rem 1rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}
    >
      {label}
    </p>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <DocumentSeo />
        <AppDialogHost />
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />

            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/qrs" element={<QrsPage />} />
              <Route path="/documentacion" element={<DocsPage />} />
              <Route path="/editor/:menuId" element={<EditorPage />} />
              <Route path="/mobile-editor/:menuId" element={<MobileEditorPage />} />
            </Route>

            <Route element={<SystemAdminRoute />}>
              <Route path="/admin/users" element={<AdminUsersPage />} />
            </Route>

            <Route
              path="/p/:slug"
              element={
                <Suspense fallback={<RouteLoading label="Cargando carta…" />}>
                  <PublicMenuPage />
                </Suspense>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
