import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { Badge, Button, Card, Input } from '../../components/ui';

interface PatientProfile {
  id: string;
  fullName: string;
  birthDate: string | null;
  phone: string | null;
}

interface ExaminationListItem {
  id: string;
  status: string;
  createdAt: string;
  thermalCapture: { minTemp: number | null; maxTemp: number | null; avgTemp: number | null; capturedAt: string } | null;
  symptomReports: { id: string; description: string; severity: number }[];
  medicalObservations: { id: string; note: string; releasedToPatient: boolean; createdAt: string }[];
}

interface SymptomReport {
  id: string;
  description: string;
  severity: number;
  reportedAt: string;
}

const statusTone: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  RECEIVED: 'default',
  PROCESSING: 'warning',
  PROCESSED: 'success',
  FAILED: 'danger',
  REVIEWED: 'success',
};

function ExaminationCard({ exam, patientId }: { exam: ExaminationListItem; patientId: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [releaseToPatient, setReleaseToPatient] = useState(false);
  const queryClient = useQueryClient();

  const viewImageMutation = useMutation({
    mutationFn: () => apiFetch<{ url: string }>(`/examinations/${exam.id}/thermal-image`),
    onSuccess: (data) => setImageUrl(data.url),
  });

  const addObservationMutation = useMutation({
    mutationFn: () =>
      apiFetch('/medical-observations', {
        method: 'POST',
        body: JSON.stringify({ examinationId: exam.id, note, releasedToPatient: releaseToPatient }),
      }),
    onSuccess: () => {
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['examinations', patientId] });
    },
  });

  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{new Date(exam.createdAt).toLocaleString('pt-BR')}</p>
        <Badge tone={statusTone[exam.status] ?? 'default'}>{exam.status}</Badge>
      </div>

      {exam.thermalCapture && (
        <p className="mt-2 text-xs text-slate-500">
          min {exam.thermalCapture.minTemp ?? '—'}°C · max {exam.thermalCapture.maxTemp ?? '—'}°C · média{' '}
          {exam.thermalCapture.avgTemp ?? '—'}°C
        </p>
      )}

      {exam.status === 'PROCESSED' || exam.status === 'REVIEWED' ? (
        <Button className="mt-3" onClick={() => viewImageMutation.mutate()}>
          {viewImageMutation.isPending ? 'Gerando link...' : 'Ver imagem térmica'}
        </Button>
      ) : (
        <p className="mt-3 text-xs text-slate-400">Imagem ainda não disponível ({exam.status}).</p>
      )}

      {imageUrl && (
        <img
          src={imageUrl}
          alt="Imagem térmica do exame"
          className="mt-3 max-w-xs rounded border border-slate-200"
        />
      )}

      {exam.symptomReports.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500">Sintomas reportados:</p>
          <ul className="list-inside list-disc text-sm text-slate-700">
            {exam.symptomReports.map((s) => (
              <li key={s.id}>
                {s.description} (severidade {s.severity})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <p className="text-xs font-medium text-slate-500">Observações médicas:</p>
        {exam.medicalObservations.map((obs) => (
          <p key={obs.id} className="text-sm text-slate-700">
            {obs.note} {obs.releasedToPatient && <Badge tone="success">liberada à paciente</Badge>}
          </p>
        ))}
      </div>

      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          addObservationMutation.mutate();
        }}
      >
        <Input placeholder="Nova observação médica" value={note} onChange={(e) => setNote(e.target.value)} required />
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={releaseToPatient} onChange={(e) => setReleaseToPatient(e.target.checked)} />
          Liberar esta observação para a paciente visualizar no app
        </label>
        <Button type="submit" disabled={addObservationMutation.isPending}>
          Adicionar observação
        </Button>
      </form>
    </Card>
  );
}

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: patient } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => apiFetch<PatientProfile>(`/patients/${id}`),
    enabled: Boolean(id),
  });

  const { data: exams } = useQuery({
    queryKey: ['examinations', id],
    queryFn: () => apiFetch<ExaminationListItem[]>(`/examinations?patientId=${id}`),
    enabled: Boolean(id),
  });

  const { data: symptoms } = useQuery({
    queryKey: ['symptoms', id],
    queryFn: () => apiFetch<SymptomReport[]>(`/symptoms?patientId=${id}`),
    enabled: Boolean(id),
  });

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">{patient?.fullName ?? 'Paciente'}</h1>
      <p className="mb-6 text-sm text-slate-500">{patient?.phone}</p>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Histórico de exames</h2>
      <div className="grid gap-4">
        {exams?.map((exam) => <ExaminationCard key={exam.id} exam={exam} patientId={id!} />)}
        {exams?.length === 0 && <p className="text-sm text-slate-500">Nenhum exame registrado ainda.</p>}
      </div>

      {symptoms && symptoms.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Todos os sintomas reportados
          </h2>
          <ul className="list-inside list-disc text-sm text-slate-700">
            {symptoms.map((s) => (
              <li key={s.id}>
                {new Date(s.reportedAt).toLocaleDateString('pt-BR')} — {s.description} (severidade {s.severity})
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
