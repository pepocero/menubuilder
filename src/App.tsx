import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth-context';
import { DocumentSeo } from '@/components/DocumentSeo';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/ProtectedRoute';
import { DashboardPage } from '@/routes/DashboardPage';
import { EditorPage } from '@/routes/EditorPage';
import { LandingPage } from '@/routes/LandingPage';
import { LoginPage } from '@/routes/LoginPage';
import { PublicMenuPage } from '@/routes/PublicMenuPage';
import { QrsPage } from '@/routes/QrsPage';
import { RegisterPage } from '@/routes/RegisterPage';
import { TemplatesPage } from '@/routes/TemplatesPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <DocumentSeo />
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
            <Route path="/editor/:menuId" element={<EditorPage />} />
          </Route>

          <Route path="/p/:slug" element={<PublicMenuPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
