import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

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

  const linkedIds = new Set(links?.map((l) => l.doctor.id));

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Vincular médico</Text>
      <FlatList
        data={doctors}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const existingLink = links?.find((l) => l.doctor.id === item.id);
          return (
            <View style={{ borderBottomWidth: 1, borderColor: '#e2e8f0', paddingVertical: 12 }}>
              <Text style={{ fontWeight: '600' }}>Dr(a). {item.fullName}</Text>
              <Text style={{ color: '#64748b' }}>
                CRM {item.crm} {item.specialty ? `· ${item.specialty}` : ''}
              </Text>
              {existingLink ? (
                <Text style={{ color: '#0f172a', marginTop: 4 }}>Status: {existingLink.status}</Text>
              ) : (
                <TouchableOpacity
                  onPress={() => requestLink.mutate(item.id)}
                  style={{ marginTop: 8, backgroundColor: '#0f172a', borderRadius: 8, padding: 10, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff' }}>Solicitar vínculo</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
      {!linkedIds && null}
    </View>
  );
}
