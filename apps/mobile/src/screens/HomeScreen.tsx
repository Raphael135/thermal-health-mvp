import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../api/client';
import { TEST_MODE } from '../config/server';
import { useAuthStore } from '../store/auth-store';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { AppButton, ErrorText, Heading, Subtitle } from '../components/ui';
import { TestBanner } from '../components/TestMode';
import { FlamingoLogo } from '../components/FlamingoLogo';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const MENU: { label: string; screen: keyof RootStackParamList }[] = [
  { label: 'Registrar sintomas', screen: 'Symptoms' },
  { label: 'Histórico de exames', screen: 'ExamHistory' },
  { label: 'Vincular médico', screen: 'LinkDoctor' },
  { label: 'Dispositivos conectados', screen: 'Devices' },
];

export function HomeScreen({ navigation }: Props) {
  const setTokens = useAuthStore((s) => s.setTokens);
  const [simulating, setSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // Só no modo de teste: pede ao servidor um exame de demonstração (matriz térmica falsa),
  // que segue o mesmo caminho de uma captura real. O servidor também precisa permitir
  // (ALLOW_DEMO_CAPTURE=true), senão responde que não existe.
  async function simulateCapture() {
    setSimulationError(null);
    setSimulating(true);
    try {
      await apiFetch('/examinations/demo', { method: 'POST' });
      navigation.navigate('ExamHistory');
    } catch (err) {
      setSimulationError(
        err instanceof Error && err.message !== 'Not Found'
          ? err.message
          : 'A captura de demonstração está desligada neste servidor.',
      );
    } finally {
      setSimulating(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, gap: 12 }}>
      <TestBanner />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <FlamingoLogo size={48} />
        <View>
          <Heading style={{ fontSize: 20 }}>Olá!</Heading>
          <Subtitle>O que você precisa hoje?</Subtitle>
        </View>
      </View>

      {MENU.map((item) => (
        <TouchableOpacity
          key={item.screen}
          onPress={() => navigation.navigate(item.screen as never)}
          activeOpacity={0.85}
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            padding: 18,
          }}
        >
          <Text style={{ fontFamily: fonts.semiBold, fontSize: 15, color: colors.textPrimary }}>{item.label}</Text>
        </TouchableOpacity>
      ))}

      {TEST_MODE && (
        <View style={{ gap: 6, marginTop: 4 }}>
          <AppButton label="Simular captura (teste)" variant="secondary" onPress={simulateCapture} loading={simulating} />
          {simulationError && <ErrorText>{simulationError}</ErrorText>}
        </View>
      )}

      <TouchableOpacity onPress={() => setTokens(null)} style={{ marginTop: 24 }}>
        <Text style={{ textAlign: 'center', color: colors.danger, fontFamily: fonts.medium }}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}
