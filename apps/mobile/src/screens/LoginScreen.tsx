import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../api/client';
import { useAuthStore } from '../store/auth-store';
import { loginSchema, LoginFormValues } from '../lib/schemas';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { AppButton, AppTextInput, ErrorText, Heading, Label, Subtitle } from '../components/ui';
import { FlamingoLogo } from '../components/FlamingoLogo';
import { ServerSettings, TestBanner } from '../components/TestMode';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const setTokens = useAuthStore((s) => s.setTokens);
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginFormValues) {
    setError(null);
    try {
      const tokens = await apiFetch<{ accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      await setTokens(tokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar.');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: 24, gap: 14 }}>
      <TestBanner />

      <View style={{ alignItems: 'center', marginBottom: 12 }}>
        <FlamingoLogo size={88} />
        <Heading style={{ marginTop: 16 }}>Thermal Health</Heading>
        <Subtitle style={{ marginTop: 4 }}>Acompanhamento térmico com cuidado</Subtitle>
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
            <AppTextInput
              placeholder="••••••••"
              secureTextEntry
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />
        {errors.password && <ErrorText>{errors.password.message}</ErrorText>}
      </View>

      {error && <ErrorText>{error}</ErrorText>}

      <AppButton label="Entrar" onPress={handleSubmit(onSubmit)} loading={isSubmitting} style={{ marginTop: 4 }} />

      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={{ textAlign: 'center', color: colors.primaryDark, fontFamily: fonts.medium, marginTop: 8 }}>
          Criar conta
        </Text>
      </TouchableOpacity>

      <ServerSettings />
    </View>
  );
}
