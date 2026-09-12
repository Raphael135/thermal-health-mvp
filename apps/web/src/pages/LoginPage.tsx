import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Button, Card, Input } from '../components/ui';

const DEV_LOGIN_ENABLED = import.meta.env.VITE_ALLOW_DEV_LOGIN === 'true';
const DEV_QUICK_LOGIN_USERS = [
  { label: 'Admin', email: 'admin@thermal-health.local' },
  { label: 'Médica de teste', email: 'medica@teste.com' },
];

export function LoginPage() {
  const { login, devLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDevLogin(devEmail: string) {
    setError(null);
    setLoading(true);
    try {
      await devLogin(devEmail);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Painel Médico</h1>
        <p className="mb-6 text-sm text-slate-500">Thermal Health — acesso restrito a médicos e administradores.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Senha</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        {DEV_LOGIN_ENABLED && (
          <div className="mt-6 border-t border-dashed border-amber-300 pt-4">
            <p className="mb-2 text-xs font-medium text-amber-700">
              Login rápido (fase de teste — sem senha, remova em produção)
            </p>
            <div className="flex gap-2">
              {DEV_QUICK_LOGIN_USERS.map((u) => (
                <Button
                  key={u.email}
                  type="button"
                  disabled={loading}
                  onClick={() => handleDevLogin(u.email)}
                  className="flex-1 bg-amber-500 hover:bg-amber-400"
                >
                  {u.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
