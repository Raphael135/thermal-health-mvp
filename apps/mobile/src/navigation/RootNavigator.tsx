import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useEffect } from 'react';
import { useAuthStore } from '../store/auth-store';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { SymptomsScreen } from '../screens/SymptomsScreen';
import { ExamHistoryScreen } from '../screens/ExamHistoryScreen';
import { ExamDetailScreen } from '../screens/ExamDetailScreen';
import { LinkDoctorScreen } from '../screens/LinkDoctorScreen';
import { DevicesScreen } from '../screens/DevicesScreen';
import { DevicePairingScreen } from '../screens/DevicePairingScreen';
import { CaptureStatusScreen } from '../screens/CaptureStatusScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Symptoms: undefined;
  ExamHistory: undefined;
  ExamDetail: { examinationId: string };
  LinkDoctor: undefined;
  Devices: undefined;
  DevicePairing: { deviceId: string; deviceName: string };
  CaptureStatus: { deviceId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { tokens, hydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
        {!tokens ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Criar conta' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Symptoms" component={SymptomsScreen} options={{ title: 'Sintomas' }} />
            <Stack.Screen name="ExamHistory" component={ExamHistoryScreen} options={{ title: 'Meus exames' }} />
            <Stack.Screen name="ExamDetail" component={ExamDetailScreen} options={{ title: 'Detalhes do exame' }} />
            <Stack.Screen name="LinkDoctor" component={LinkDoctorScreen} options={{ title: 'Vincular médico' }} />
            <Stack.Screen name="Devices" component={DevicesScreen} options={{ title: 'Dispositivos' }} />
            <Stack.Screen name="DevicePairing" component={DevicePairingScreen} options={{ title: 'Pareamento' }} />
            <Stack.Screen name="CaptureStatus" component={CaptureStatusScreen} options={{ title: 'Captura' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
