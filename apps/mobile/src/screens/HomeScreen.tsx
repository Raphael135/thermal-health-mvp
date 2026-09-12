import { Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/auth-store';
import type { RootStackParamList } from '../navigation/RootNavigator';

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
    <View style={{ flex: 1, padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 8 }}>Olá!</Text>

      {MENU.map((item) => (
        <TouchableOpacity
          key={item.screen}
          onPress={() => navigation.navigate(item.screen as never)}
          style={{ backgroundColor: '#f1f5f9', borderRadius: 8, padding: 16 }}
        >
          <Text style={{ fontWeight: '600', color: '#0f172a' }}>{item.label}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity onPress={() => setTokens(null)} style={{ marginTop: 24 }}>
        <Text style={{ textAlign: 'center', color: '#dc2626' }}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}
