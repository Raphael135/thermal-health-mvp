import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../api/client';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { BodyText, Heading, Label, Subtitle } from '../components/ui';
import { colors } from '../theme/colors';

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
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 24, gap: 14 }}>
      <Heading style={{ fontSize: 18 }}>Detalhes do exame</Heading>
      <Subtitle>
        Este app não exibe a imagem térmica nem os dados brutos — apenas o médico responsável tem acesso a eles.
      </Subtitle>

      {data && (
        <>
          <View>
            <Label>Data</Label>
            <BodyText>{new Date(data.createdAt).toLocaleString('pt-BR')}</BodyText>
          </View>
          <View>
            <Label>Status</Label>
            <BodyText>{data.status}</BodyText>
          </View>

          <Label style={{ marginTop: 8 }}>Observações do médico</Label>
          {data.medicalObservations.length === 0 && (
            <Subtitle>Nenhuma observação liberada até o momento.</Subtitle>
          )}
          {data.medicalObservations.map((obs) => (
            <View key={obs.id} style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 8 }}>
              <BodyText>{obs.note}</BodyText>
              <Subtitle style={{ marginTop: 2 }}>
                Dr(a). {obs.doctor.fullName} · {new Date(obs.createdAt).toLocaleDateString('pt-BR')}
              </Subtitle>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}
