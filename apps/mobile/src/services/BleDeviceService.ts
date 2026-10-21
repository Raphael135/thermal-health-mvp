import { PermissionsAndroid, Platform } from 'react-native';
import { BleError, BleErrorCode, BleManager, Device, State, Subscription } from 'react-native-ble-plx';
import type { CaptureStatus, IDeviceService, ScannedDevice } from './DeviceService';
import {
  COMMAND_UUID,
  DeviceStatus,
  PATIENT_UUID,
  PREFERRED_MTU,
  SERVICE_UUID,
  STATUS_UUID,
  WIFI_UUID,
  decodeStatus,
  encodePatientId,
  encodeStartCapture,
  encodeWifi,
  errorMessage,
  fromBase64,
  toBase64,
} from './ble/protocol';

const CONNECT_TIMEOUT_MS = 15_000;
const PAIRING_BUDGET_MS = 40_000; // dá tempo de o usuário digitar a senha de pareamento
const PAIRING_RETRY_MS = 1_500;
const WIFI_TIMEOUT_MS = 25_000; // o firmware espera até 15 s pelo Wi-Fi
const BLUETOOTH_WAIT_MS = 3_000;

/** Erro com mensagem pronta para mostrar ao usuário. */
export class DeviceError extends Error {}

type StatusListener = (status: DeviceStatus) => void;

interface Connection {
  device: Device;
  status: DeviceStatus | null;
  lostMessage: string | null;
  listeners: Set<StatusListener>;
  subscriptions: Subscription[];
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function describe(error: unknown): DeviceError {
  if (error instanceof DeviceError) return error;
  if (error instanceof BleError) {
    switch (error.errorCode) {
      case BleErrorCode.BluetoothUnauthorized:
        return new DeviceError('O app não tem permissão de Bluetooth. Libere nas configurações do celular.');
      case BleErrorCode.BluetoothPoweredOff:
        return new DeviceError('O Bluetooth está desligado. Ligue e tente de novo.');
      case BleErrorCode.BluetoothUnsupported:
        return new DeviceError('Este celular não suporta Bluetooth de baixo consumo.');
      case BleErrorCode.DeviceConnectionFailed:
      case BleErrorCode.OperationTimedOut:
        return new DeviceError('Não consegui conectar ao aparelho. Aproxime o celular e tente de novo.');
      case BleErrorCode.DeviceDisconnected:
        return new DeviceError('A conexão com o aparelho foi perdida.');
      case BleErrorCode.ScanStartFailed:
        return new DeviceError('Não consegui procurar aparelhos. Confira o Bluetooth e as permissões.');
      default:
        return new DeviceError(`Falha na comunicação com o aparelho (${error.message}).`);
    }
  }
  return new DeviceError(error instanceof Error ? error.message : 'Falha na comunicação com o aparelho.');
}

export class BleDeviceService implements IDeviceService {
  private manager: BleManager | null = null;
  private connections = new Map<string, Connection>();

  // Criado só no primeiro uso, para não tocar no módulo nativo antes da hora.
  private getManager(): BleManager {
    if (this.manager === null) this.manager = new BleManager();
    return this.manager;
  }

  // ---- permissões e estado do Bluetooth ---------------------------------------------

  private async ensurePermissions(): Promise<void> {
    if (Platform.OS !== 'android') return;

    const granted = PermissionsAndroid.RESULTS.GRANTED;
    if ((Platform.Version as number) >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      if (
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] !== granted ||
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] !== granted
      ) {
        throw new DeviceError('Sem permissão para usar o Bluetooth. Libere "Dispositivos próximos" nas configurações do app.');
      }
      return;
    }

    // Android 11 ou anterior: procurar aparelhos BLE exige a permissão de localização.
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    if (result !== granted) {
      throw new DeviceError('Sem permissão de localização, que o Android exige para procurar aparelhos Bluetooth.');
    }
  }

  private async ensureBluetoothOn(manager: BleManager): Promise<void> {
    let state = await manager.state();
    if (state === State.Unknown || state === State.Resetting) {
      state = await new Promise<State>((resolve) => {
        const timer = setTimeout(() => {
          subscription.remove();
          resolve(State.Unknown);
        }, BLUETOOTH_WAIT_MS);
        const subscription = manager.onStateChange((next) => {
          if (next !== State.Unknown && next !== State.Resetting) {
            clearTimeout(timer);
            subscription.remove();
            resolve(next);
          }
        }, true);
      });
    }

    if (state === State.PoweredOn) return;
    if (state === State.Unsupported) throw new DeviceError('Este celular não suporta Bluetooth de baixo consumo.');
    if (state === State.Unauthorized) throw new DeviceError('O app não tem permissão de Bluetooth.');
    if (state === State.PoweredOff && Platform.OS === 'android') {
      try {
        await manager.enable(); // o Android pede ao usuário para ligar
        return;
      } catch {
        // recusou
      }
    }
    throw new DeviceError('O Bluetooth está desligado. Ligue e tente de novo.');
  }

  // ---- IDeviceService ---------------------------------------------------------------

  async scan(onDeviceFound: (device: ScannedDevice) => void, durationMs = 8000): Promise<void> {
    try {
      await this.ensurePermissions();
      const manager = this.getManager();
      await this.ensureBluetoothOn(manager);

      await new Promise<void>((resolve, reject) => {
        const seen = new Map<string, string | null>();
        let finished = false;
        const finish = (error?: unknown) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          manager.stopDeviceScan();
          if (error) reject(error);
          else resolve();
        };
        const timer = setTimeout(() => finish(), durationMs);

        // allowDuplicates: o nome vem na resposta de varredura, que chega depois do anúncio.
        manager.startDeviceScan([SERVICE_UUID], { allowDuplicates: true }, (error, device) => {
          if (error) {
            finish(error);
            return;
          }
          if (!device) return;
          const name = device.localName ?? device.name ?? null;
          if (seen.has(device.id) && seen.get(device.id) === name) return;
          seen.set(device.id, name);
          onDeviceFound({ id: device.id, name: name ?? 'Aparelho Thermal Health', rssi: device.rssi ?? 0 });
        });
      });
    } catch (error) {
      throw describe(error);
    }
  }

  async connect(deviceId: string): Promise<void> {
    await this.disconnect(deviceId);

    try {
      await this.ensurePermissions();
      const manager = this.getManager();
      await this.ensureBluetoothOn(manager);

      let device = await manager.connectToDevice(deviceId, { timeout: CONNECT_TIMEOUT_MS });
      device = await device.discoverAllServicesAndCharacteristics();
      if (Platform.OS === 'android') {
        try {
          device = await device.requestMTU(PREFERRED_MTU);
        } catch {
          // segue com o MTU padrão: funciona, só é mais lento
        }
      }

      const connection: Connection = {
        device,
        status: null,
        lostMessage: null,
        listeners: new Set(),
        subscriptions: [],
      };
      this.connections.set(deviceId, connection);
      connection.subscriptions.push(
        device.onDisconnected(() => {
          connection.lostMessage = 'A conexão com o aparelho foi perdida. A captura pode ter terminado: confira o histórico.';
        }),
      );

      // As características exigem link criptografado. A primeira leitura dispara o pareamento
      // (e o Android mostra a janela de senha, se o firmware exigir), então tentamos de novo
      // até o usuário concluir.
      await this.readStatusUntilPaired(connection);

      connection.subscriptions.push(
        device.monitorCharacteristicForService(SERVICE_UUID, STATUS_UUID, (error, characteristic) => {
          if (error || !characteristic?.value) return;
          this.applyStatus(connection, fromBase64(characteristic.value));
        }),
      );
    } catch (error) {
      await this.disconnect(deviceId);
      throw describe(error);
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    const connection = this.connections.get(deviceId);
    this.connections.delete(deviceId);
    connection?.subscriptions.forEach((subscription) => subscription.remove());
    try {
      await this.getManager().cancelDeviceConnection(deviceId);
    } catch {
      // já estava desconectado
    }
  }

  async setPatient(deviceId: string, patientId: string): Promise<void> {
    try {
      await this.write(deviceId, PATIENT_UUID, encodePatientId(patientId));
    } catch (error) {
      throw describe(error);
    }
  }

  async sendWifiConfig(deviceId: string, ssid: string, password: string): Promise<void> {
    const connection = this.requireConnection(deviceId);
    const frame = encodeWifi(ssid, password); // valida antes de falar com o aparelho

    // O ouvinte é registrado ANTES da escrita para não perder o primeiro aviso do aparelho.
    const outcome = this.waitForWifi(connection);
    try {
      await this.write(deviceId, WIFI_UUID, frame);
    } catch (error) {
      outcome.cancel();
      throw describe(error);
    }
    await outcome.promise;
  }

  async startCapture(deviceId: string): Promise<void> {
    const connection = this.requireConnection(deviceId);
    connection.lostMessage = null;
    try {
      await this.write(deviceId, COMMAND_UUID, encodeStartCapture());
    } catch (error) {
      throw describe(error);
    }
  }

  async getCaptureStatus(deviceId: string): Promise<CaptureStatus> {
    const connection = this.connections.get(deviceId);
    if (!connection || connection.lostMessage) return 'error';
    return connection.status?.state ?? 'idle';
  }

  getErrorMessage(deviceId: string): string | null {
    const connection = this.connections.get(deviceId);
    if (!connection) return 'Sem conexão com o aparelho.';
    if (connection.lostMessage) return connection.lostMessage;
    return connection.status ? errorMessage(connection.status.errorCode) : null;
  }

  // ---- internos ---------------------------------------------------------------------

  private requireConnection(deviceId: string): Connection {
    const connection = this.connections.get(deviceId);
    if (!connection) throw new DeviceError('Sem conexão com o aparelho. Conecte de novo.');
    return connection;
  }

  private applyStatus(connection: Connection, bytes: Uint8Array): void {
    const status = decodeStatus(bytes);
    if (status === null) return;
    connection.status = status;
    connection.listeners.forEach((listener) => listener(status));
  }

  private async write(deviceId: string, characteristicUuid: string, bytes: Uint8Array): Promise<void> {
    const connection = this.requireConnection(deviceId);
    await connection.device.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      characteristicUuid,
      toBase64(bytes),
    );
  }

  private async readStatusUntilPaired(connection: Connection): Promise<void> {
    const deadline = Date.now() + PAIRING_BUDGET_MS;
    for (;;) {
      try {
        const characteristic = await connection.device.readCharacteristicForService(SERVICE_UUID, STATUS_UUID);
        if (characteristic.value) this.applyStatus(connection, fromBase64(characteristic.value));
        return;
      } catch (error) {
        if (error instanceof BleError && error.errorCode === BleErrorCode.DeviceDisconnected) throw error;
        if (Date.now() >= deadline) {
          throw new DeviceError('O pareamento com o aparelho não foi concluído. Tente de novo e confirme a senha, se pedida.');
        }
        await sleep(PAIRING_RETRY_MS);
      }
    }
  }

  private waitForWifi(connection: Connection): { promise: Promise<void>; cancel: () => void } {
    let cancel: () => void = () => undefined;
    const promise = new Promise<void>((resolve, reject) => {
      let sawConnecting = false;
      const finish = (error?: DeviceError) => {
        clearTimeout(timer);
        connection.listeners.delete(listener);
        if (error) reject(error);
        else resolve();
      };
      const listener: StatusListener = (status) => {
        if (status.state === 'connecting_wifi') {
          sawConnecting = true;
        } else if (status.state === 'error') {
          finish(new DeviceError(errorMessage(status.errorCode) ?? 'O aparelho não conseguiu conectar ao Wi-Fi.'));
        } else if (status.state === 'idle' && status.wifiConnected && sawConnecting) {
          finish();
        }
      };
      const timer = setTimeout(
        () => finish(new DeviceError('O aparelho não respondeu a tempo. Confira o Wi-Fi e tente de novo.')),
        WIFI_TIMEOUT_MS,
      );
      connection.listeners.add(listener);
      cancel = () => {
        clearTimeout(timer);
        connection.listeners.delete(listener);
      };
    });
    // evita aviso de promessa rejeitada sem tratamento quando o chamador cancela antes
    promise.catch(() => undefined);
    return { promise, cancel };
  }
}
