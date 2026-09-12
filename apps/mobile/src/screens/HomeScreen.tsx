import { Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/auth-store';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Heading, Subtitle } from '../components/ui';
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, gap: 12 }}>
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

      <TouchableOpacity onPress={() => setTokens(null)} style={{ marginTop: 24 }}>
        <Text style={{ textAlign: 'center', color: colors.danger, fontFamily: fonts.medium }}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}
