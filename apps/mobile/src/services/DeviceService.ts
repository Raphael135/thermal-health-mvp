import { Platform } from 'react-native';

export interface ScannedDevice {
  id: string; // identificador da conexão (endereço BLE no aparelho real; hardwareId no simulador)
  name: string; // nome anunciado, igual ao hardwareId cadastrado no painel admin
  rssi: number;
}

export type CaptureStatus = 'idle' | 'connecting_wifi' | 'capturing' | 'uploading' | 'done' | 'error';

/**
 * Contrato de comunicação com o dispositivo (ESP32). Há duas implementações:
 * - BleDeviceService: BLE de verdade (react-native-ble-plx), protocolo em docs/BLE_PROTOCOL.md.
 * - SimulatedDeviceService: dados falsos, para a versão web e para builds de teste sem aparelho.
 * As telas só enxergam esta interface.
 */
export interface IDeviceService {
  /** Procura aparelhos. Lança Error com mensagem para o usuário (Bluetooth desligado, sem permissão...). */
  scan(onDeviceFound: (device: ScannedDevice) => void, durationMs?: number): Promise<void>;
  /** Conecta e pareia. Pode levar até ~40 s se o usuário precisar digitar a senha de pareamento. */
  connect(deviceId: string): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  /** Informa ao aparelho a quem pertencem as capturas (PatientProfile.id). */
  setPatient(deviceId: string, patientId: string): Promise<void>;
  /** Envia o Wi-Fi e espera o aparelho conectar. Lança Error se ele não conseguir. */
  sendWifiConfig(deviceId: string, ssid: string, password: string): Promise<void>;
  startCapture(deviceId: string): Promise<void>;
  getCaptureStatus(deviceId: string): Promise<CaptureStatus>;
  /** Motivo legível do último erro do aparelho (ou da conexão), se houver. */
  getErrorMessage(deviceId: string): string | null;
}

const FAKE_DEVICES: ScannedDevice[] = [
  { id: 'ESP32-001', name: 'Thermal Health Device 001', rssi: -45 },
  { id: 'ESP32-002', name: 'Thermal Health Device 002', rssi: -67 },
];

export class SimulatedDeviceService implements IDeviceService {
  private statusByDevice = new Map<string, CaptureStatus>();

  async scan(onDeviceFound: (device: ScannedDevice) => void, durationMs = 3000): Promise<void> {
    const delayStep = durationMs / FAKE_DEVICES.length;
    for (const device of FAKE_DEVICES) {
      await new Promise((resolve) => setTimeout(resolve, delayStep));
      onDeviceFound(device);
    }
  }

  async connect(deviceId: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 800));
    this.statusByDevice.set(deviceId, 'idle');
  }

  async disconnect(deviceId: string): Promise<void> {
    this.statusByDevice.delete(deviceId);
  }

  async setPatient(_deviceId: string, _patientId: string): Promise<void> {}

  async sendWifiConfig(deviceId: string, _ssid: string, _password: string): Promise<void> {
    this.statusByDevice.set(deviceId, 'connecting_wifi');
    await new Promise((resolve) => setTimeout(resolve, 1200));
    this.statusByDevice.set(deviceId, 'idle');
  }

  async startCapture(deviceId: string): Promise<void> {
    this.statusByDevice.set(deviceId, 'capturing');
    setTimeout(() => this.statusByDevice.set(deviceId, 'uploading'), 1500);
    setTimeout(() => this.statusByDevice.set(deviceId, 'done'), 3000);
  }

  async getCaptureStatus(deviceId: string): Promise<CaptureStatus> {
    return this.statusByDevice.get(deviceId) ?? 'idle';
  }

  getErrorMessage(_deviceId: string): string | null {
    return null;
  }
}

export type DeviceMode = 'ble' | 'simulated';

// Na web (preview no navegador) não há BLE: sempre simulado. No celular, BLE real, a menos que o
// build force EXPO_PUBLIC_DEVICE_MODE=simulated (ex.: APK de teste sem aparelho).
function pickMode(): DeviceMode {
  if (Platform.OS === 'web') return 'simulated';
  return process.env.EXPO_PUBLIC_DEVICE_MODE === 'simulated' ? 'simulated' : 'ble';
}

export const DEVICE_MODE: DeviceMode = pickMode();

function createService(): IDeviceService {
  if (DEVICE_MODE === 'ble') {
    // require tardio: o módulo nativo de BLE só é carregado quando realmente usado.
    const { BleDeviceService } = require('./BleDeviceService') as typeof import('./BleDeviceService');
    return new BleDeviceService();
  }
  return new SimulatedDeviceService();
}

export const DeviceService: IDeviceService = createService();
