import { Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth-context';
import { DocumentSeo } from '@/components/DocumentSeo';
import {
  ProtectedRoute,
  PublicOnlyRoute,
  SystemAdminRoute,
} from '@/components/ProtectedRoute';
import { LandingPage } from '@/routes/LandingPage';
import { PublicMenuPage } from '@/routes/PublicMenuPage';
import { AppDialogHost } from '@/components/ui/AppDialogHost';
import { clearChunkReloadFlag, lazyWithRetry } from '@/lib/lazy-retry';

const AdminUsersPage = lazyWithRetry(() =>
  import('@/routes/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
);
const DashboardPage = lazyWithRetry(() =>
  import('@/routes/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const DocsPage = lazyWithRetry(() =>
  import('@/routes/DocsPage').then((m) => ({ default: m.DocsPage })),
);
const EditorPage = lazyWithRetry(() =>
  import('@/routes/EditorPage').then((m) => ({ default: m.EditorPage })),
);
const LoginPage = lazyWithRetry(() =>
  import('@/routes/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const MobileEditorPage = lazyWithRetry(() =>
  import('@/routes/MobileEditorPage').then((m) => ({ default: m.MobileEditorPage })),
);
const QrsPage = lazyWithRetry(() =>
  import('@/routes/QrsPage').then((m) => ({ default: m.QrsPage })),
);
const RegisterPage = lazyWithRetry(() =>
  import('@/routes/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);
const TemplatesPage = lazyWithRetry(() =>
  import('@/routes/TemplatesPage').then((m) => ({ default: m.TemplatesPage })),
);

clearChunkReloadFlag();

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

            <Route path="/p/:slug" element={<PublicMenuPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
