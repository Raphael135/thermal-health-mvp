import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DeviceService, ScannedDevice } from '../services/DeviceService';
import type { RootStackParamList } from '../navigation/RootNavigator';

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
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 4 }}>Dispositivos próximos</Text>
      <Text style={{ color: '#64748b', marginBottom: 12 }}>
        Modo simulado (sem BLE real) — útil para testar o app sem o hardware físico.
      </Text>

      {scanning && <ActivityIndicator style={{ marginBottom: 12 }} />}

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('DevicePairing', { deviceId: item.id, deviceName: item.name })}
            style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginBottom: 8 }}
          >
            <Text style={{ fontWeight: '600' }}>{item.name}</Text>
            <Text style={{ color: '#64748b' }}>
              {item.id} · sinal {item.rssi} dBm
            </Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity onPress={startScan} disabled={scanning}>
        <Text style={{ textAlign: 'center', color: '#0f172a', marginTop: 8 }}>Procurar novamente</Text>
      </TouchableOpacity>
    </View>
  );
}
