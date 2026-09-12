import { FlatList, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { symptomSchema, SymptomFormValues } from '../lib/schemas';
import { AppButton, AppTextInput, BodyText, Card, ErrorText, Heading, Label, Subtitle } from '../components/ui';
import { colors } from '../theme/colors';

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
  } = useForm<SymptomFormValues>({
    resolver: zodResolver(symptomSchema),
    defaultValues: { description: '', severity: 1 },
  });

  const createSymptom = useMutation({
    mutationFn: (values: SymptomFormValues) =>
      apiFetch('/symptoms', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      reset({ description: '', severity: 1 });
      queryClient.invalidateQueries({ queryKey: ['symptoms', 'me'] });
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, gap: 10 }}>
      <Heading style={{ fontSize: 18 }}>Registrar sintoma</Heading>

      <View style={{ gap: 4 }}>
        <Label>Descrição</Label>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <AppTextInput
              placeholder="Descreva o que está sentindo"
              value={field.value}
              onChangeText={field.onChange}
              multiline
            />
          )}
        />
        {errors.description && <ErrorText>{errors.description.message}</ErrorText>}
      </View>

      <View style={{ gap: 4 }}>
        <Label>Severidade (1 a 5)</Label>
        <Controller
          control={control}
          name="severity"
          render={({ field }) => (
            <AppTextInput
              placeholder="1"
              keyboardType="numeric"
              value={String(field.value)}
              onChangeText={(v) => field.onChange(Number(v))}
            />
          )}
        />
      </View>

      <AppButton label="Salvar" onPress={handleSubmit((v) => createSymptom.mutate(v))} loading={isSubmitting} />

      <Heading style={{ fontSize: 16, marginTop: 16 }}>Histórico</Heading>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <Card>
            <BodyText>{item.description}</BodyText>
            <Subtitle style={{ marginTop: 4 }}>
              Severidade {item.severity} · {new Date(item.reportedAt).toLocaleDateString('pt-BR')}
            </Subtitle>
          </Card>
        )}
        ListEmptyComponent={<Subtitle>Nenhum sintoma registrado ainda.</Subtitle>}
      />
    </View>
  );
}
