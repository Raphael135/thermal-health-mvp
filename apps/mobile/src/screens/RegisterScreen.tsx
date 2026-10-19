import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../api/client';
import { useAuthStore } from '../store/auth-store';
import { registerSchema, RegisterFormValues } from '../lib/schemas';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { AppButton, AppTextInput, ErrorText, Heading, Label, Subtitle } from '../components/ui';
import { colors } from '../theme/colors';
import { ServerSettings, TestBanner } from '../components/TestMode';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen(_props: Props) {
  const setTokens = useAuthStore((s) => s.setTokens);
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', phone: '' },
  });

  async function onSubmit(values: RegisterFormValues) {
    setError(null);
    try {
      const tokens = await apiFetch<{ accessToken: string; refreshToken: string }>('/auth/register/patient', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      await setTokens(tokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta.');
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 }}
    >
      <TestBanner />
      <Heading style={{ marginBottom: 4 }}>Criar conta</Heading>
      <Subtitle style={{ marginBottom: 12 }}>Leva menos de um minuto</Subtitle>

      <View style={{ gap: 4 }}>
        <Label>Nome completo</Label>
        <Controller
          control={control}
          name="fullName"
          render={({ field }) => (
            <AppTextInput placeholder="Seu nome" value={field.value} onChangeText={field.onChange} />
          )}
        />
        {errors.fullName && <ErrorText>{errors.fullName.message}</ErrorText>}
      </View>

      <View style={{ gap: 4 }}>
        <Label>E-mail</Label>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <AppTextInput
              placeholder="voce@exemplo.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />
        {errors.email && <ErrorText>{errors.email.message}</ErrorText>}
      </View>

      <View style={{ gap: 4 }}>
        <Label>Senha</Label>
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <AppTextInput placeholder="••••••••" secureTextEntry value={field.value} onChangeText={field.onChange} />
          )}
        />
        {errors.password && <ErrorText>{errors.password.message}</ErrorText>}
      </View>

      <View style={{ gap: 4 }}>
        <Label>Telefone (opcional)</Label>
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <AppTextInput placeholder="(11) 90000-0000" value={field.value} onChangeText={field.onChange} />
          )}
        />
      </View>

      {error && <ErrorText>{error}</ErrorText>}

      <AppButton label="Cadastrar" onPress={handleSubmit(onSubmit)} loading={isSubmitting} style={{ marginTop: 8 }} />

      <ServerSettings />
    </ScrollView>
  );
}
