import { FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { symptomSchema, SymptomFormValues } from '../lib/schemas';

interface SymptomReport {
  id: string;
  description: string;
  severity: number;
  reportedAt: string;
}

export function SymptomsScreen() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['symptoms', 'me'], queryFn: () => apiFetch<SymptomReport[]>('/symptoms/me') });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SymptomFormValues>({ resolver: zodResolver(symptomSchema), defaultValues: { severity: 1 } });

  const createSymptom = useMutation({
    mutationFn: (values: SymptomFormValues) =>
      apiFetch('/symptoms', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      reset({ description: '', severity: 1 });
      queryClient.invalidateQueries({ queryKey: ['symptoms', 'me'] });
    },
  });

  return (
    <View style={{ flex: 1, padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Registrar sintoma</Text>

      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <TextInput
            placeholder="Descreva o que está sentindo"
            value={field.value}
            onChangeText={field.onChange}
            style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12 }}
            multiline
          />
        )}
      />
      {errors.description && <Text style={{ color: '#dc2626', fontSize: 12 }}>{errors.description.message}</Text>}

      <Controller
        control={control}
        name="severity"
        render={({ field }) => (
          <TextInput
            placeholder="Severidade (1 a 5)"
            keyboardType="numeric"
            value={String(field.value)}
            onChangeText={(v) => field.onChange(Number(v))}
            style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12 }}
          />
        )}
      />

      <TouchableOpacity
        onPress={handleSubmit((v) => createSymptom.mutate(v))}
        disabled={isSubmitting}
        style={{ backgroundColor: '#0f172a', borderRadius: 8, padding: 14, alignItems: 'center' }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>Salvar</Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 16, fontWeight: '700', marginTop: 16 }}>Histórico</Text>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ borderBottomWidth: 1, borderColor: '#e2e8f0', paddingVertical: 8 }}>
            <Text>{item.description}</Text>
            <Text style={{ color: '#64748b', fontSize: 12 }}>
              Severidade {item.severity} · {new Date(item.reportedAt).toLocaleDateString('pt-BR')}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
