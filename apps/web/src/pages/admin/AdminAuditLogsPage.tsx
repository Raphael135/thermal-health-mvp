import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { Card } from '../../components/ui';

interface AuditLogItem {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export function AdminAuditLogsPage() {
  const { data } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => apiFetch<AuditLogItem[]>('/audit-logs'),
  });

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Logs de auditoria</h1>
      <p className="mb-4 text-sm text-slate-500">
        Somente metadados de acesso — o admin nunca vê o conteúdo das imagens térmicas aqui.
      </p>
      <div className="grid gap-2">
        {data?.map((log) => (
          <Card key={log.id} className="py-3">
            <p className="text-sm text-slate-800">
              <span className="font-medium">{log.action}</span> em {log.resourceType}
              {log.resourceId ? ` (${log.resourceId})` : ''}
            </p>
            <p className="text-xs text-slate-500">
              usuário {log.userId ?? '—'} · ip {log.ipAddress ?? '—'} ·{' '}
              {new Date(log.createdAt).toLocaleString('pt-BR')}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
