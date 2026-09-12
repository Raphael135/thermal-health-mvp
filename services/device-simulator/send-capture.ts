import 'dotenv/config';

/**
 * Simula um ESP32 com sensor térmico enviando uma captura para a API.
 * Substitui o hardware real enquanto ele não está disponível — ver
 * firmware/esp32/main/thermal_sensor.c para a mesma ideia em C.
 *
 * Uso:
 *   API_URL=http://localhost:3000 \
 *   DEVICE_ID=ESP32-001 \
 *   DEVICE_SECRET=<segredo retornado ao cadastrar o dispositivo> \
 *   PATIENT_ID=<uuid do PatientProfile vinculado ao dispositivo> \
 *   npm run simulate
 */

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const DEVICE_ID = process.env.DEVICE_ID ?? 'ESP32-001';
const DEVICE_SECRET = process.env.DEVICE_SECRET;
const PATIENT_ID = process.env.PATIENT_ID;

const WIDTH = 32;
const HEIGHT = 24;

function simulateThermalFrame(): number[] {
  const baseline = 31 + Math.random(); // temperatura corporal ambiente simulada
  const frame: number[] = [];
  const centerX = WIDTH / 2;
  const centerY = HEIGHT / 2;

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const distance = Math.hypot(x - centerX, y - centerY);
      const hotspot = Math.max(0, 4 - distance * 0.3); // "quente" no centro, simulando a região da mama
      const noise = (Math.random() - 0.5) * 0.6;
      frame.push(Number((baseline + hotspot + noise).toFixed(2)));
    }
  }

  return frame;
}

async function main() {
  if (!DEVICE_SECRET || !PATIENT_ID) {
    console.error('Defina DEVICE_SECRET e PATIENT_ID nas variáveis de ambiente.');
    process.exit(1);
  }

  const payload = {
    patientId: PATIENT_ID,
    width: WIDTH,
    height: HEIGHT,
    unit: 'celsius',
    temperatures: simulateThermalFrame(),
    capturedAt: new Date().toISOString(),
  };

  console.log(`Enviando captura simulada do dispositivo ${DEVICE_ID} para ${API_URL}...`);

  const response = await fetch(`${API_URL}/device-captures`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': DEVICE_ID,
      'x-device-secret': DEVICE_SECRET,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    console.error(`Falha (${response.status}):`, body);
    process.exit(1);
  }

  console.log('Captura aceita:', body);
}

main();
