import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../api/client';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Heading, Subtitle } from '../components/ui';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

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
    // enquanto algum exame ainda está sendo processado, atualiza sozinho
    refetchInterval: (query) =>
      query.state.data?.some((e) => e.status === 'RECEIVED' || e.status === 'PROCESSING') ? 3000 : false,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
      <Heading style={{ fontSize: 18, marginBottom: 12 }}>Histórico de exames</Heading>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ExamDetail', { examinationId: item.id })}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              padding: 14,
            }}
          >
            <Text style={{ fontFamily: fonts.semiBold, color: colors.textPrimary }}>
              {new Date(item.createdAt).toLocaleDateString('pt-BR')}
            </Text>
            <Subtitle style={{ marginTop: 2 }}>{statusLabel[item.status]}</Subtitle>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Subtitle>Nenhum exame registrado ainda.</Subtitle>}
      />
    </View>
  );
}
