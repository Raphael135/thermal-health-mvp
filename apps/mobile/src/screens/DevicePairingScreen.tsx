import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../api/client';
import { DeviceService } from '../services/DeviceService';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { AppButton, AppTextInput, ErrorText, Heading, Label, Subtitle } from '../components/ui';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'DevicePairing'>;

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function DevicePairingScreen({ route, navigation }: Props) {
  const { deviceId, deviceName } = route.params;
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [sendingWifi, setSendingWifi] = useState(false);
  const [wifiDone, setWifiDone] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connectedRef = useRef(false);

  // O aparelho precisa saber a quem pertencem as capturas; o servidor só aceita se o aparelho
  // estiver vinculado a esta paciente no painel admin.
  const { data: patient, isError: patientError } = useQuery({
    queryKey: ['patient', 'me'],
    queryFn: () => apiFetch<{ id: string }>('/patients/me'),
  });

  useEffect(() => {
    return () => {
      if (connectedRef.current) DeviceService.disconnect(deviceId).catch(() => undefined);
    };
  }, [deviceId]);

  async function handleConnect() {
    if (!patient) {
      setError('Não consegui carregar seu cadastro. Verifique a internet e tente de novo.');
      return;
    }
    setError(null);
    setConnecting(true);
    try {
      await DeviceService.connect(deviceId);
      connectedRef.current = true;
      await DeviceService.setPatient(deviceId, patient.id);
      setConnected(true);
    } catch (err) {
      setError(messageOf(err, 'Não consegui conectar ao aparelho.'));
    } finally {
      setConnecting(false);
    }
  }

  async function handleSendWifi() {
    setError(null);
    setWifiDone(false);
    setSendingWifi(true);
    try {
      await DeviceService.sendWifiConfig(deviceId, ssid.trim(), password);
      setWifiDone(true);
    } catch (err) {
      setError(messageOf(err, 'Não consegui configurar o Wi-Fi do aparelho.'));
    } finally {
      setSendingWifi(false);
    }
  }

  async function handleStartCapture() {
    setError(null);
    setStarting(true);
    try {
      await DeviceService.startCapture(deviceId);
      connectedRef.current = false; // a tela de status continua usando a conexão
      navigation.navigate('CaptureStatus', { deviceId });
    } catch (err) {
      setError(messageOf(err, 'Não consegui iniciar a captura.'));
    } finally {
      setStarting(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 24, gap: 12 }}>
      <Heading style={{ fontSize: 18 }}>{deviceName}</Heading>

      {!connected ? (
        <>
          <Subtitle>
            Se o aparelho pedir uma senha de pareamento, o Android vai mostrar uma janela. Isso pode levar alguns segundos.
          </Subtitle>
          <AppButton label="Conectar via BLE" onPress={handleConnect} loading={connecting} />
          {patientError && <ErrorText>Não consegui carregar seu cadastro.</ErrorText>}
        </>
      ) : (
        <>
          <Label style={{ color: colors.success }}>Conectado</Label>

          <Label style={{ marginTop: 8 }}>Wi-Fi do aparelho</Label>
          <Subtitle>
            É a rede pela qual o aparelho vai enviar a captura. Precisa ter internet e ser de 2,4 GHz.
          </Subtitle>
          <AppTextInput
            placeholder="Nome da rede (SSID)"
            value={ssid}
            onChangeText={setSsid}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <AppTextInput
            placeholder="Senha da rede"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <AppButton label="Enviar Wi-Fi" variant="secondary" onPress={handleSendWifi} loading={sendingWifi} />
          {wifiDone && <Label style={{ color: colors.success }}>Wi-Fi conectado.</Label>}

          <View style={{ marginTop: 12 }}>
            <AppButton label="Iniciar captura" onPress={handleStartCapture} loading={starting} />
          </View>
        </>
      )}

      {error && <ErrorText>{error}</ErrorText>}
    </ScrollView>
  );
}
