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
    set({ tokens: raw ? JSON.parse(raw) : null, hydrated: true });
  },
}));
