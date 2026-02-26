import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuthContext } from './lib/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { ModuleSelectPage } from './pages/ModuleSelectPage';
import { EmployeeDashboard } from './pages/employee/DashboardPage';
import { ApplyLeavePage } from './pages/employee/ApplyLeavePage';
import { ApplicationsPage } from './pages/employee/ApplicationsPage';
import { HRDashboardPage } from './pages/hr/HRDashboardPage';
import { HRApplicationsPage } from './pages/hr/HRApplicationsPage';
import { EmployeesPage } from './pages/hr/EmployeesPage';
import { CreditsPage } from './pages/hr/CreditsPage';
import { AuditLogPage } from './pages/hr/AuditLogPage';
import { COSDashboardPage } from './pages/cos/COSDashboardPage';
import { COSListPage } from './pages/cos/COSListPage';
import { AdminPage } from './pages/admin/AdminPage';
import type { ReactNode } from 'react';

function ProtectedRoute({ children, requiredRole }: { children: ReactNode; requiredRole?: string }) {
  const { profile, loading } = useAuthContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!profile) return <Navigate to="/login" replace />;
  if (requiredRole && profile.role !== requiredRole) {
    return <Navigate to={profile.role === 'hr_admin' ? '/hr/dashboard' : '/dashboard'} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { profile, loading } = useAuthContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Module selection hub */}
      <Route
        path="/modules"
        element={
          <ProtectedRoute>
            <ModuleSelectPage />
          </ProtectedRoute>
        }
      />

      {/* Employee routes */}
      <Route
        element={
          <ProtectedRoute requiredRole="employee">
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<EmployeeDashboard />} />
        <Route path="/apply" element={<ApplyLeavePage />} />
        <Route path="/applications" element={<ApplicationsPage />} />
      </Route>

      {/* HR Admin routes */}
      <Route
        element={
          <ProtectedRoute requiredRole="hr_admin">
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/hr/dashboard" element={<HRDashboardPage />} />
        <Route path="/hr/applications" element={<HRApplicationsPage />} />
        <Route path="/hr/employees" element={<EmployeesPage />} />
        <Route path="/hr/credits" element={<CreditsPage />} />
        <Route path="/hr/activity-log" element={<AuditLogPage />} />
      </Route>

      {/* COS routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/cos/dashboard" element={<COSDashboardPage />} />
        <Route path="/cos/list" element={<COSListPage />} />
      </Route>

      {/* Admin routes */}
      <Route
        element={
          <ProtectedRoute requiredRole="hr_admin">
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin/settings" element={<AdminPage />} />
      </Route>

      {/* Default redirect */}
      <Route
        path="*"
        element={
          profile ? (
            <Navigate to="/modules" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
