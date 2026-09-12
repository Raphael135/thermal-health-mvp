import { ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../api/client';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ExamDetail'>;

interface PatientExaminationDetail {
  id: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  device: { name: string | null; hardwareId: string } | null;
  medicalObservations: { id: string; note: string; createdAt: string; doctor: { fullName: string } }[];
}

export function ExamDetailScreen({ route }: Props) {
  const { examinationId } = route.params;
  const { data } = useQuery({
    queryKey: ['examination', examinationId],
    queryFn: () => apiFetch<PatientExaminationDetail>(`/examinations/${examinationId}`),
  });

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Detalhes do exame</Text>
      <Text style={{ color: '#64748b' }}>
        Este app não exibe a imagem térmica nem os dados brutos — apenas o médico responsável tem acesso a eles.
      </Text>

      {data && (
        <>
          <View>
            <Text style={{ fontWeight: '600' }}>Data</Text>
            <Text>{new Date(data.createdAt).toLocaleString('pt-BR')}</Text>
          </View>
          <View>
            <Text style={{ fontWeight: '600' }}>Status</Text>
            <Text>{data.status}</Text>
          </View>

          <Text style={{ fontWeight: '600', marginTop: 12 }}>Observações do médico</Text>
          {data.medicalObservations.length === 0 && (
            <Text style={{ color: '#64748b' }}>Nenhuma observação liberada até o momento.</Text>
          )}
          {data.medicalObservations.map((obs) => (
            <View key={obs.id} style={{ borderTopWidth: 1, borderColor: '#e2e8f0', paddingTop: 8 }}>
              <Text>{obs.note}</Text>
              <Text style={{ color: '#64748b', fontSize: 12 }}>
                Dr(a). {obs.doctor.fullName} · {new Date(obs.createdAt).toLocaleDateString('pt-BR')}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}
