import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  tokens: Tokens | null;
  hydrated: boolean;
  setTokens: (tokens: Tokens | null) => Promise<void>;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = 'thermal-health/auth-tokens';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * Login automático sem senha, só para a fase de teste — evita ter que digitar
 * e-mail/senha toda vez que o app recarrega. Só dispara se EXPO_PUBLIC_ALLOW_DEV_LOGIN
 * estiver "true" (a API também precisa ter ALLOW_DEV_LOGIN=true, senão o request falha).
 * Ver services/api/src/auth/auth.service.ts (devLogin) e docs/DECISIONS.md.
 */
async function tryDevAutoLogin(): Promise<Tokens | null> {
  if (process.env.EXPO_PUBLIC_ALLOW_DEV_LOGIN !== 'true') return null;

  const email = process.env.EXPO_PUBLIC_DEV_LOGIN_EMAIL ?? 'paciente@teste.com';
  try {
    const res = await fetch(`${API_URL}/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return null;
    return (await res.json()) as Tokens;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  tokens: null,
  hydrated: false,
  setTokens: async (tokens) => {
    if (tokens) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
    set({ tokens });
  },
  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    let tokens: Tokens | null = raw ? JSON.parse(raw) : null;

    if (!tokens) {
      tokens = await tryDevAutoLogin();
      if (tokens) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    }

    set({ tokens, hydrated: true });
  },
}));
