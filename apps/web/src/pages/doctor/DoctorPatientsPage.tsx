import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { Badge, Button, Card } from '../../components/ui';

interface PatientListItem {
  id: string;
  fullName: string;
  createdAt: string;
}

interface PatientLink {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'REVOKED';
  patient: { id: string; fullName: string };
}

export function DoctorPatientsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['patients'],
    queryFn: () => apiFetch<PatientListItem[]>('/patients'),
  });

  const { data: links } = useQuery({
    queryKey: ['doctor-links'],
    queryFn: () => apiFetch<PatientLink[]>('/doctors/me/patient-links'),
  });
  const pending = links?.filter((l) => l.status === 'PENDING') ?? [];

  const accept = useMutation({
    mutationFn: (linkId: string) => apiFetch(`/doctors/me/patient-links/${linkId}/accept`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-links'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });

  return (
    <div>
      {pending.length > 0 && (
        <div className="mb-8">
          <h1 className="mb-4 text-lg font-semibold text-slate-900">Solicitações de vínculo</h1>
          <div className="grid gap-3">
            {pending.map((link) => (
              <Card key={link.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{link.patient.fullName}</p>
                  <Badge tone="warning">aguardando sua aprovação</Badge>
                </div>
                <Button onClick={() => accept.mutate(link.id)} disabled={accept.isPending}>
                  Aceitar
                </Button>
              </Card>
            ))}
          </div>
          {accept.isError && <p className="mt-2 text-sm text-red-600">{(accept.error as Error).message}</p>}
        </div>
      )}

      <h1 className="mb-4 text-lg font-semibold text-slate-900">Pacientes vinculadas</h1>
      {isLoading && <p className="text-sm text-slate-500">Carregando...</p>}
      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}
      <div className="grid gap-3">
        {data?.map((patient) => (
          <Link key={patient.id} to={`/patients/${patient.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <p className="font-medium text-slate-900">{patient.fullName}</p>
              <p className="text-xs text-slate-500">
                Vinculada desde {new Date(patient.createdAt).toLocaleDateString('pt-BR')}
              </p>
            </Card>
          </Link>
        ))}
        {data?.length === 0 && <p className="text-sm text-slate-500">Nenhuma paciente vinculada ainda.</p>}
      </div>
    </div>
  );
}
