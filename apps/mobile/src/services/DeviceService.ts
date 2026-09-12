export interface ScannedDevice {
  id: string; // hardwareId, ex: "ESP32-001"
  name: string;
  rssi: number;
}

export type CaptureStatus = 'idle' | 'connecting_wifi' | 'capturing' | 'uploading' | 'done' | 'error';

/**
 * Contrato de comunicação com o dispositivo (ESP32). No MVP, a implementação é
 * simulada (SimulatedDeviceService). Para usar BLE real, criar uma nova classe
 * que implemente esta mesma interface (ex.: BleDeviceService usando
 * react-native-ble-plx) e trocar a instância exportada em `index.ts` — nenhuma
 * tela precisa mudar.
 */
export interface IDeviceService {
  scan(onDeviceFound: (device: ScannedDevice) => void, durationMs?: number): Promise<void>;
  connect(deviceId: string): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  sendWifiConfig(deviceId: string, ssid: string, password: string): Promise<void>;
  startCapture(deviceId: string): Promise<void>;
  getCaptureStatus(deviceId: string): Promise<CaptureStatus>;
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
}

export const DeviceService: IDeviceService = new SimulatedDeviceService();
