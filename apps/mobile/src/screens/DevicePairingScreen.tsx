import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DeviceService } from '../services/DeviceService';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { AppButton, AppTextInput, Heading, Label } from '../components/ui';
import { colors } from '../theme/colors';

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
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, gap: 12 }}>
      <Heading style={{ fontSize: 18 }}>{deviceName}</Heading>

      {!connected ? (
        <AppButton label="Conectar via BLE" onPress={handleConnect} loading={connecting} />
      ) : (
        <>
          <Label style={{ color: colors.success }}>Conectado</Label>

          <Label style={{ marginTop: 8 }}>Configurar Wi-Fi do dispositivo</Label>
          <AppTextInput placeholder="Nome da rede (SSID)" value={ssid} onChangeText={setSsid} />
          <AppTextInput placeholder="Senha da rede" secureTextEntry value={password} onChangeText={setPassword} />
          <AppButton
            label="Enviar configuração"
            variant="secondary"
            onPress={handleSendWifi}
            loading={sendingWifi}
          />

          <AppButton label="Iniciar captura" onPress={handleStartCapture} style={{ marginTop: 12 }} />
        </>
      )}
    </View>
  );
}
