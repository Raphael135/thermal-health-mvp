import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../api/client';
import { useAuthStore } from '../store/auth-store';
import { registerSchema, RegisterFormValues } from '../lib/schemas';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen(_props: Props) {
  const setTokens = useAuthStore((s) => s.setTokens);
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

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
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 8 }}>Criar conta</Text>

      <Controller
        control={control}
        name="fullName"
        render={({ field }) => (
          <TextInput placeholder="Nome completo" value={field.value} onChangeText={field.onChange} style={inputStyle} />
        )}
      />
      {errors.fullName && <Text style={errorStyle}>{errors.fullName.message}</Text>}

      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextInput
            placeholder="E-mail"
            autoCapitalize="none"
            keyboardType="email-address"
            value={field.value}
            onChangeText={field.onChange}
            style={inputStyle}
          />
        )}
      />
      {errors.email && <Text style={errorStyle}>{errors.email.message}</Text>}

      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextInput placeholder="Senha" secureTextEntry value={field.value} onChangeText={field.onChange} style={inputStyle} />
        )}
      />
      {errors.password && <Text style={errorStyle}>{errors.password.message}</Text>}

      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <TextInput placeholder="Telefone (opcional)" value={field.value} onChangeText={field.onChange} style={inputStyle} />
        )}
      />

      {error && <Text style={errorStyle}>{error}</Text>}

      <TouchableOpacity onPress={handleSubmit(onSubmit)} disabled={isSubmitting} style={buttonStyle}>
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={buttonTextStyle}>Cadastrar</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const inputStyle = { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12 };
const errorStyle = { color: '#dc2626', fontSize: 12 };
const buttonStyle = { backgroundColor: '#0f172a', borderRadius: 8, padding: 14, alignItems: 'center' as const };
const buttonTextStyle = { color: '#fff', fontWeight: '600' as const };
