import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { Card } from '../../components/ui';

interface PatientListItem {
  id: string;
  fullName: string;
  createdAt: string;
}

export function DoctorPatientsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['patients'],
    queryFn: () => apiFetch<PatientListItem[]>('/patients'),
  });

  return (
    <div>
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
        {data?.length === 0 && (
          <p className="text-sm text-slate-500">Nenhuma paciente vinculada ainda.</p>
        )}
      </div>
    </div>
  );
}
