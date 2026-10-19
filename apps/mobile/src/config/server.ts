import AsyncStorage from '@react-native-async-storage/async-storage';

// Endereço da API. Vem do build (EXPO_PUBLIC_API_URL), mas pode ser trocado dentro do app
// (modo de teste) sem gerar outro APK — útil quando a API roda atrás de um túnel temporário
// cuja URL muda a cada execução.
const STORAGE_KEY = 'thermal-health/server-url';
const DEFAULT_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const TEST_MODE = process.env.EXPO_PUBLIC_TEST_MODE === 'true';

let currentUrl = DEFAULT_URL;

export function getApiUrl(): string {
  return currentUrl;
}

export function normalizeServerUrl(input: string): string | null {
  const trimmed = input.trim().replace(/\/+$/, '');
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return trimmed;
  } catch {
    return null;
  }
}

export async function loadApiUrl(): Promise<void> {
  if (!TEST_MODE) return;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const valid = stored ? normalizeServerUrl(stored) : null;
    if (valid) currentUrl = valid;
  } catch {
    // sem armazenamento: continua com o endereço do build
  }
}

/** Retorna false se o endereço for inválido. */
export async function saveApiUrl(input: string): Promise<boolean> {
  const valid = normalizeServerUrl(input);
  if (!valid) return false;
  currentUrl = valid;
  await AsyncStorage.setItem(STORAGE_KEY, valid);
  return true;
}
