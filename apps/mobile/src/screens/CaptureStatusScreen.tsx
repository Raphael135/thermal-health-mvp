import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DeviceService, CaptureStatus } from '../services/DeviceService';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { FlamingoLogo } from '../components/FlamingoLogo';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'CaptureStatus'>;

const labels: Record<CaptureStatus, string> = {
  idle: 'Aguardando início',
  connecting_wifi: 'Conectando ao Wi-Fi',
  capturing: 'Capturando dados térmicos',
  uploading: 'Enviando para o servidor',
  done: 'Captura enviada com sucesso',
  error: 'Ocorreu um erro na captura',
};

export function CaptureStatusScreen({ route, navigation }: Props) {
  const { deviceId } = route.params;
  const [status, setStatus] = useState<CaptureStatus>('idle');

  useEffect(() => {
    const interval = setInterval(async () => {
      const current = await DeviceService.getCaptureStatus(deviceId);
      setStatus(current);
    }, 500);
    return () => clearInterval(interval);
  }, [deviceId]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        gap: 16,
      }}
    >
      {status === 'done' ? (
        <FlamingoLogo size={72} />
      ) : status !== 'error' ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : null}
      <Text
        style={{ fontFamily: fonts.semiBold, fontSize: 17, color: colors.textPrimary, textAlign: 'center' }}
      >
        {labels[status]}
      </Text>

      {status === 'done' && (
        <Text
          style={{
            color: colors.primaryDark,
            fontFamily: fonts.medium,
            textDecorationLine: 'underline',
          }}
          onPress={() => navigation.navigate('ExamHistory')}
        >
          Ver no histórico de exames
        </Text>
      )}
    </View>
  );
}
