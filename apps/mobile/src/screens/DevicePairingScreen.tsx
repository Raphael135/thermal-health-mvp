import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DeviceService } from '../services/DeviceService';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DevicePairing'>;

export function DevicePairingScreen({ route, navigation }: Props) {
  const { deviceId, deviceName } = route.params;
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [sendingWifi, setSendingWifi] = useState(false);

  async function handleConnect() {
    setConnecting(true);
    await DeviceService.connect(deviceId);
    setConnected(true);
    setConnecting(false);
  }

  async function handleSendWifi() {
    setSendingWifi(true);
    await DeviceService.sendWifiConfig(deviceId, ssid, password);
    setSendingWifi(false);
  }

  async function handleStartCapture() {
    await DeviceService.startCapture(deviceId);
    navigation.navigate('CaptureStatus', { deviceId });
  }

  return (
    <View style={{ flex: 1, padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>{deviceName}</Text>

      {!connected ? (
        <TouchableOpacity
          onPress={handleConnect}
          disabled={connecting}
          style={{ backgroundColor: '#0f172a', borderRadius: 8, padding: 14, alignItems: 'center' }}
        >
          {connecting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff' }}>Conectar via BLE</Text>}
        </TouchableOpacity>
      ) : (
        <>
          <Text style={{ color: '#16a34a', fontWeight: '600' }}>Conectado</Text>

          <Text style={{ fontWeight: '600', marginTop: 8 }}>Configurar Wi-Fi do dispositivo</Text>
          <TextInput
            placeholder="Nome da rede (SSID)"
            value={ssid}
            onChangeText={setSsid}
            style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12 }}
          />
          <TextInput
            placeholder="Senha da rede"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12 }}
          />
          <TouchableOpacity
            onPress={handleSendWifi}
            disabled={sendingWifi}
            style={{ backgroundColor: '#334155', borderRadius: 8, padding: 12, alignItems: 'center' }}
          >
            {sendingWifi ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff' }}>Enviar configuração</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleStartCapture}
            style={{ backgroundColor: '#0f172a', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Iniciar captura</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
