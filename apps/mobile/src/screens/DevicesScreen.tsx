import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DEVICE_MODE, DeviceService, ScannedDevice } from '../services/DeviceService';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { ErrorText, Heading, Subtitle } from '../components/ui';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Devices'>;

export function DevicesScreen({ navigation }: Props) {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<ScannedDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);

  async function startScan() {
    setDevices([]);
    setError(null);
    setScanned(false);
    setScanning(true);
    try {
      await DeviceService.scan((device) =>
        // o mesmo aparelho pode ser anunciado várias vezes (o nome chega depois): atualiza em vez de duplicar
        setDevices((prev) => {
          const index = prev.findIndex((d) => d.id === device.id);
          if (index === -1) return [...prev, device];
          const next = [...prev];
          next[index] = device;
          return next;
        }),
      );
      setScanned(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui procurar aparelhos.');
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    startScan();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
      <Heading style={{ fontSize: 18, marginBottom: 4 }}>Dispositivos próximos</Heading>
      <Subtitle style={{ marginBottom: 12 }}>
        {DEVICE_MODE === 'simulated'
          ? 'Modo simulado (sem BLE real) — útil para testar o app sem o hardware físico.'
          : 'Ligue o aparelho e aproxime o celular. Só aparecem aparelhos Thermal Health.'}
      </Subtitle>

      {scanning && <ActivityIndicator color={colors.primary} style={{ marginBottom: 12 }} />}
      {error && <ErrorText style={{ marginBottom: 12 }}>{error}</ErrorText>}

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
              {DEVICE_MODE === 'simulated' ? `${item.id} · ` : ''}sinal {item.rssi} dBm
            </Subtitle>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          scanned && !error ? (
            <Subtitle>Nenhum aparelho encontrado. Confira se ele está ligado e perto do celular.</Subtitle>
          ) : null
        }
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
