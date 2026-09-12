import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth-context';
import { LoginPage } from './pages/LoginPage';
import { ProtectedLayout } from './components/ProtectedLayout';
import { DoctorPatientsPage } from './pages/doctor/DoctorPatientsPage';
import { PatientDetailPage } from './pages/doctor/PatientDetailPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminDevicesPage } from './pages/admin/AdminDevicesPage';
import { AdminLinksPage } from './pages/admin/AdminLinksPage';
import { AdminAuditLogsPage } from './pages/admin/AdminAuditLogsPage';

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin/users" replace />;
  return <DoctorPatientsPage />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedLayout allowedRoles={['DOCTOR', 'ADMIN']} />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/devices" element={<AdminDevicesPage />} />
        <Route path="/admin/links" element={<AdminLinksPage />} />
        <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
