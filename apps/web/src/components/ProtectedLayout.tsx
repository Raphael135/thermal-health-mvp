import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

interface ProtectedLayoutProps {
  allowedRoles: Array<'DOCTOR' | 'ADMIN'>;
}

export function ProtectedLayout({ allowedRoles }: ProtectedLayoutProps) {
  const { user, logout } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role as 'DOCTOR' | 'ADMIN')) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-slate-900">Thermal Health</span>
          {user.role === 'DOCTOR' && (
            <NavLink to="/" className="text-sm text-slate-600 hover:text-slate-900">
              Minhas pacientes
            </NavLink>
          )}
          {user.role === 'ADMIN' && (
            <>
              <NavLink to="/admin/users" className="text-sm text-slate-600 hover:text-slate-900">
                Usuários
              </NavLink>
              <NavLink to="/admin/devices" className="text-sm text-slate-600 hover:text-slate-900">
                Dispositivos
              </NavLink>
              <NavLink to="/admin/links" className="text-sm text-slate-600 hover:text-slate-900">
                Vínculos
              </NavLink>
              <NavLink to="/admin/audit-logs" className="text-sm text-slate-600 hover:text-slate-900">
                Logs de auditoria
              </NavLink>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>{user.email}</span>
          <button onClick={logout} className="text-slate-400 hover:text-slate-700">
            Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
