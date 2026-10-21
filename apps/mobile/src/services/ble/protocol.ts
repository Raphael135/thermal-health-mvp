// Protocolo BLE entre o app e o firmware. Espelha firmware/esp32/main/ble_protocol.c e
// docs/BLE_PROTOCOL.md. Sem nenhuma dependência de BLE nem de React Native: dá para testar no Node.

export const SERVICE_UUID = '7e5f0001-1c3a-4b8e-9d2a-6f3b8c1e0a00';
export const WIFI_UUID = '7e5f0002-1c3a-4b8e-9d2a-6f3b8c1e0a00';
export const PATIENT_UUID = '7e5f0003-1c3a-4b8e-9d2a-6f3b8c1e0a00';
export const COMMAND_UUID = '7e5f0004-1c3a-4b8e-9d2a-6f3b8c1e0a00';
export const STATUS_UUID = '7e5f0005-1c3a-4b8e-9d2a-6f3b8c1e0a00';

export const WIFI_SSID_MAX = 32;
export const WIFI_PASSWORD_MIN = 8;
export const WIFI_PASSWORD_MAX = 63;
export const CMD_START_CAPTURE = 0x01;
export const PREFERRED_MTU = 247;

export type DeviceState = 'idle' | 'connecting_wifi' | 'capturing' | 'uploading' | 'done' | 'error';

const STATE_BY_CODE: DeviceState[] = ['idle', 'connecting_wifi', 'capturing', 'uploading', 'done', 'error'];

export const ERROR_NONE = 0;
export const ERROR_BUSY = 5;
export const ERROR_WIFI_FAILED = 6;

const ERROR_MESSAGES: Record<number, string> = {
  1: 'O aparelho não está conectado ao Wi-Fi. Envie o Wi-Fi antes de capturar.',
  2: 'O aparelho ainda não sabe a qual paciente pertence. Refaça o pareamento.',
  3: 'O aparelho não conseguiu ler o sensor térmico.',
  4: 'O aparelho não conseguiu enviar a captura para o servidor. Confira o Wi-Fi e o endereço do servidor.',
  5: 'O aparelho está ocupado com outra operação. Aguarde e tente de novo.',
  6: 'O aparelho não conseguiu conectar ao Wi-Fi. Confira o nome e a senha da rede.',
  7: 'Erro interno no aparelho.',
};

export function errorMessage(code: number): string | null {
  if (code === ERROR_NONE) return null;
  return ERROR_MESSAGES[code] ?? `Erro ${code} no aparelho.`;
}

export interface DeviceStatus {
  state: DeviceState;
  wifiConnected: boolean;
  patientSet: boolean;
  errorCode: number;
}

/** Status: [estado:1][flags:1][erro:1]. Devolve null se o tamanho ou o estado forem inválidos. */
export function decodeStatus(bytes: Uint8Array): DeviceStatus | null {
  if (bytes.length !== 3) return null;
  const state = STATE_BY_CODE[bytes[0]];
  if (state === undefined) return null;
  return {
    state,
    wifiConnected: (bytes[1] & 0x01) !== 0,
    patientSet: (bytes[1] & 0x02) !== 0,
    errorCode: bytes[2],
  };
}

function utf8(text: string): Uint8Array {
  // TextEncoder existe no Hermes e no Node; evita depender de Buffer (que não existe no React Native).
  return new TextEncoder().encode(text);
}

/** Wi-Fi: [tam_ssid:1][ssid][tam_senha:1][senha]. Lança Error com mensagem para o usuário. */
export function encodeWifi(ssid: string, password: string): Uint8Array {
  const ssidBytes = utf8(ssid);
  const passBytes = utf8(password);

  if (ssidBytes.length === 0) throw new Error('Informe o nome da rede Wi-Fi.');
  if (ssidBytes.length > WIFI_SSID_MAX) throw new Error('O nome da rede tem mais de 32 bytes.');
  if (passBytes.length !== 0 && passBytes.length < WIFI_PASSWORD_MIN) {
    throw new Error('A senha do Wi-Fi precisa ter pelo menos 8 caracteres (ou ficar vazia, para rede aberta).');
  }
  if (passBytes.length > WIFI_PASSWORD_MAX) throw new Error('A senha do Wi-Fi tem mais de 63 bytes.');
  if (ssidBytes.includes(0) || passBytes.includes(0)) {
    throw new Error('O nome ou a senha do Wi-Fi contém um caractere inválido.');
  }

  const out = new Uint8Array(2 + ssidBytes.length + passBytes.length);
  out[0] = ssidBytes.length;
  out.set(ssidBytes, 1);
  out[1 + ssidBytes.length] = passBytes.length;
  out.set(passBytes, 2 + ssidBytes.length);
  return out;
}

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** patientId: os 36 caracteres ASCII do UUID. */
export function encodePatientId(patientId: string): Uint8Array {
  if (!UUID_PATTERN.test(patientId)) throw new Error('Identificador de paciente inválido.');
  return utf8(patientId);
}

export function encodeStartCapture(): Uint8Array {
  return Uint8Array.of(CMD_START_CAPTURE);
}

// ---- base64 (a biblioteca de BLE troca valores nesse formato) ----------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[b2 & 0x3f] : '=';
  }
  return out;
}

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of clean) {
    const value = B64.indexOf(char);
    if (value < 0) throw new Error('Valor base64 inválido.');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, index);
}
