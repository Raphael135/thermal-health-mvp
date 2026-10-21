import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { Badge, Button, Card } from '../../components/ui';

interface AdminUser {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  patientProfile: { id: string; fullName: string } | null;
  doctorProfile: { id: string; fullName: string; crm: string } | null;
}

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin-users'], queryFn: () => apiFetch<AdminUser[]>('/admin/users') });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/admin/users/${id}/active`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Usuários</h1>
      <div className="grid gap-3">
        {data?.map((u) => (
          <Card key={u.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">
                {u.patientProfile?.fullName ?? u.doctorProfile?.fullName ?? u.email}
              </p>
              <p className="text-xs text-slate-500">
                {u.email} · {u.role} {u.doctorProfile && `· CRM ${u.doctorProfile.crm}`}
              </p>
              {(u.patientProfile ?? u.doctorProfile) && (
                <p className="text-xs text-slate-400">
                  ID do perfil (para vínculos e aparelhos):{' '}
                  <code className="select-all font-mono">{(u.patientProfile ?? u.doctorProfile)!.id}</code>
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={u.isActive ? 'success' : 'danger'}>{u.isActive ? 'ativo' : 'inativo'}</Badge>
              <Button onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}>
                {u.isActive ? 'Desativar' : 'Ativar'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
