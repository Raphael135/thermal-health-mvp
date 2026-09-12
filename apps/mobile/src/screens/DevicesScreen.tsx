import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DeviceService, ScannedDevice } from '../services/DeviceService';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Heading, Subtitle } from '../components/ui';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Devices'>;

export function DevicesScreen({ navigation }: Props) {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<ScannedDevice[]>([]);

  async function startScan() {
    setDevices([]);
    setScanning(true);
    await DeviceService.scan((device) => setDevices((prev) => [...prev, device]));
    setScanning(false);
  }

  useEffect(() => {
    startScan();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
      <Heading style={{ fontSize: 18, marginBottom: 4 }}>Dispositivos próximos</Heading>
      <Subtitle style={{ marginBottom: 12 }}>
        Modo simulado (sem BLE real) — útil para testar o app sem o hardware físico.
      </Subtitle>

      {scanning && <ActivityIndicator color={colors.primary} style={{ marginBottom: 12 }} />}

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('DevicePairing', { deviceId: item.id, deviceName: item.name })}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              padding: 14,
            }}
          >
            <Text style={{ fontFamily: fonts.semiBold, color: colors.textPrimary }}>{item.name}</Text>
            <Subtitle style={{ marginTop: 2 }}>
              {item.id} · sinal {item.rssi} dBm
            </Subtitle>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity onPress={startScan} disabled={scanning}>
        <Text
          style={{ textAlign: 'center', color: colors.primaryDark, fontFamily: fonts.medium, marginTop: 12 }}
        >
          Procurar novamente
        </Text>
      </TouchableOpacity>
    </View>
  );
}
