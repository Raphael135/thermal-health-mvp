import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../api/client';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ExamHistory'>;

// Campos permitidos para a paciente ver — o backend já filtra isso (PatientsService/
// ExaminationsService), mas o tipo aqui documenta explicitamente o que NÃO existe:
// nunca há imagem, matriz bruta ou temperaturas detalhadas.
interface PatientExaminationItem {
  id: string;
  status: 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'REVIEWED';
  createdAt: string;
  reviewedAt: string | null;
  device: { name: string | null } | null;
  medicalObservations: { id: string; note: string }[];
}

const statusLabel: Record<PatientExaminationItem['status'], string> = {
  RECEIVED: 'Recebido, aguardando processamento',
  PROCESSING: 'Processando',
  PROCESSED: 'Processado — aguardando revisão médica',
  FAILED: 'Falha no processamento',
  REVIEWED: 'Revisado pelo médico',
};

export function ExamHistoryScreen({ navigation }: Props) {
  const { data } = useQuery({
    queryKey: ['examinations', 'me'],
    queryFn: () => apiFetch<PatientExaminationItem[]>('/examinations/me'),
  });

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Histórico de exames</Text>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('ExamDetail', { examinationId: item.id })}
            style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginBottom: 8 }}
          >
            <Text style={{ fontWeight: '600' }}>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</Text>
            <Text style={{ color: '#64748b' }}>{statusLabel[item.status]}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{ color: '#64748b' }}>Nenhum exame registrado ainda.</Text>}
      />
    </View>
  );
}
