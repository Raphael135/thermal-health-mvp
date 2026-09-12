import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { Badge, Button, Card, Input } from '../../components/ui';

interface Device {
  id: string;
  hardwareId: string;
  name: string | null;
  status: string;
  ownerPatientId: string | null;
  lastSeenAt: string | null;
}

export function AdminDevicesPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin-devices'], queryFn: () => apiFetch<Device[]>('/admin/devices') });
  const [hardwareId, setHardwareId] = useState('');
  const [name, setName] = useState('');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const createDevice = useMutation({
    mutationFn: () =>
      apiFetch<{ device: Device; secret: string }>('/admin/devices', {
        method: 'POST',
        body: JSON.stringify({ hardwareId, name }),
      }),
    onSuccess: (result) => {
      setCreatedSecret(result.secret);
      setHardwareId('');
      setName('');
      queryClient.invalidateQueries({ queryKey: ['admin-devices'] });
    },
  });

  const linkPatient = useMutation({
    mutationFn: ({ id, patientProfileId }: { id: string; patientProfileId: string }) =>
      apiFetch(`/admin/devices/${id}/link-patient`, { method: 'PATCH', body: JSON.stringify({ patientProfileId }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-devices'] }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setCreatedSecret(null);
    createDevice.mutate();
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Dispositivos</h1>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Cadastrar novo dispositivo</h2>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input placeholder="ID do hardware (ex: ESP32-001)" value={hardwareId} onChange={(e) => setHardwareId(e.target.value)} required />
          <Input placeholder="Nome (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={createDevice.isPending}>
            Cadastrar
          </Button>
        </form>
        {createdSecret && (
          <p className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-800">
            Segredo do dispositivo (copie agora — não será mostrado novamente):{' '}
            <code className="font-mono">{createdSecret}</code>
          </p>
        )}
      </Card>

      <div className="grid gap-3">
        {data?.map((d) => (
          <Card key={d.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">{d.name ?? d.hardwareId}</p>
              <p className="text-xs text-slate-500">
                {d.hardwareId} · último contato:{' '}
                {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString('pt-BR') : 'nunca'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={d.status === 'ACTIVE' ? 'success' : 'danger'}>{d.status}</Badge>
              <Input
                placeholder="UUID da paciente"
                className="w-56"
                defaultValue={d.ownerPatientId ?? ''}
                onBlur={(e) => {
                  if (e.target.value && e.target.value !== d.ownerPatientId) {
                    linkPatient.mutate({ id: d.id, patientProfileId: e.target.value });
                  }
                }}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
