import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { Badge, Button, Card, Input } from '../../components/ui';

interface LinkItem {
  id: string;
  status: string;
  doctor: { fullName: string; crm: string };
  patient: { fullName: string };
}

export function AdminLinksPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin-links'], queryFn: () => apiFetch<LinkItem[]>('/admin/doctor-patient-links') });
  const [doctorProfileId, setDoctorProfileId] = useState('');
  const [patientProfileId, setPatientProfileId] = useState('');

  const createLink = useMutation({
    mutationFn: () =>
      apiFetch('/admin/doctor-patient-links', {
        method: 'POST',
        body: JSON.stringify({ doctorProfileId, patientProfileId }),
      }),
    onSuccess: () => {
      setDoctorProfileId('');
      setPatientProfileId('');
      queryClient.invalidateQueries({ queryKey: ['admin-links'] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createLink.mutate();
  }

  const statusTone = { ACTIVE: 'success', PENDING: 'warning', REVOKED: 'danger' } as const;

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Vínculos médico-paciente</h1>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Criar vínculo ativo</h2>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input placeholder="UUID do DoctorProfile" value={doctorProfileId} onChange={(e) => setDoctorProfileId(e.target.value)} required />
          <Input placeholder="UUID do PatientProfile" value={patientProfileId} onChange={(e) => setPatientProfileId(e.target.value)} required />
          <Button type="submit" disabled={createLink.isPending}>
            Vincular
          </Button>
        </form>
      </Card>

      <div className="grid gap-3">
        {data?.map((link) => (
          <Card key={link.id} className="flex items-center justify-between">
            <p className="text-sm text-slate-700">
              Dr(a). {link.doctor.fullName} (CRM {link.doctor.crm}) ↔ {link.patient.fullName}
            </p>
            <Badge tone={statusTone[link.status as keyof typeof statusTone] ?? 'default'}>{link.status}</Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}
