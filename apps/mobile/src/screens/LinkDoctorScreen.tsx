import { FlatList, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { AppButton, BodyText, Card, Heading, Subtitle } from '../components/ui';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

interface Doctor {
  id: string;
  fullName: string;
  crm: string;
  specialty: string | null;
}

interface DoctorLink {
  id: string;
  status: string;
  doctor: { id: string; fullName: string; crm: string };
}

export function LinkDoctorScreen() {
  const queryClient = useQueryClient();
  const { data: doctors } = useQuery({ queryKey: ['doctors'], queryFn: () => apiFetch<Doctor[]>('/doctors') });
  const { data: links } = useQuery({
    queryKey: ['doctor-links', 'me'],
    queryFn: () => apiFetch<DoctorLink[]>('/patients/me/doctor-links'),
  });

  const requestLink = useMutation({
    mutationFn: (doctorProfileId: string) =>
      apiFetch('/patients/me/doctor-links', { method: 'POST', body: JSON.stringify({ doctorProfileId }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doctor-links', 'me'] }),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
      <Heading style={{ fontSize: 18, marginBottom: 12 }}>Vincular médico</Heading>
      <FlatList
        data={doctors}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => {
          const existingLink = links?.find((l) => l.doctor.id === item.id);
          return (
            <Card>
              <BodyText style={{ fontFamily: fonts.semiBold }}>Dr(a). {item.fullName}</BodyText>
              <Subtitle>
                CRM {item.crm} {item.specialty ? `· ${item.specialty}` : ''}
              </Subtitle>
              {existingLink ? (
                <Subtitle style={{ marginTop: 6, color: colors.primaryDark, fontFamily: fonts.medium }}>
                  Status: {existingLink.status}
                </Subtitle>
              ) : (
                <AppButton
                  label="Solicitar vínculo"
                  onPress={() => requestLink.mutate(item.id)}
                  style={{ marginTop: 10, paddingVertical: 10 }}
                />
              )}
            </Card>
          );
        }}
        ListEmptyComponent={<Subtitle>Nenhum médico disponível ainda.</Subtitle>}
      />
    </View>
  );
}
