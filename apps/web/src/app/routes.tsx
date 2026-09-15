import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { AdminLayout } from './components/admin-layout';
import { SchedulePage } from './components/pages/schedule-page';
import { DashboardPage } from './components/pages/dashboard-page';
import { ClientsPage } from './components/pages/clients-page';
import { ClientDetailPage } from './components/pages/client-detail-page';
import { SalaryPage } from './components/pages/salary-page';
import { SettingsPage } from './components/pages/settings-page';
import { AuditPage } from './components/pages/audit-page';
import { OnboardingPage } from './components/pages/onboarding-page';
import { BookingWidget } from './components/booking/BookingWidget';
import { ClientPortalPage } from './components/pages/client-portal-page';
import { LoginPage } from './components/pages/login-page';
import { SuperadminPage } from './components/pages/superadmin-page';
import { useAuth } from './lib/auth';
import { StoreProvider } from './lib/store';

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
      <div className="w-8 h-8 border-2 border-[#2D6BE4] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  // у супер-админа нет своей автомойки — только платформенная панель
  if (user.role === 'superadmin') return <Navigate to="/admin" replace />;
  return (
    <StoreProvider>
      <Outlet />
    </StoreProvider>
  );
}

function SuperadminOnly() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'superadmin') return <Navigate to="/" replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  { path: '/login', Component: LoginPage },
  { path: '/booking/:slug', Component: BookingWidget },
  { path: '/client/:slug', Component: ClientPortalPage },
  {
    Component: SuperadminOnly,
    children: [{ path: '/admin', Component: SuperadminPage }],
  },
  {
    Component: Protected,
    children: [
      { path: '/onboarding', Component: OnboardingPage },
      {
        path: '/',
        Component: AdminLayout,
        children: [
          { index: true, Component: DashboardPage },
          { path: 'schedule', Component: SchedulePage },
          { path: 'clients', Component: ClientsPage },
          { path: 'clients/:id', Component: ClientDetailPage },
          { path: 'salary', Component: SalaryPage },
          { path: 'settings', Component: SettingsPage },
          { path: 'audit', Component: AuditPage },
        ],
      },
    ],
  },
], { basename: import.meta.env.BASE_URL });
