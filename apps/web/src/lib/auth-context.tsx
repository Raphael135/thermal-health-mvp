import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { apiFetch, authStorage } from './api';
import { decodeAccessToken, AccessTokenPayload } from './jwt';

interface AuthContextValue {
  user: AccessTokenPayload | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readUserFromStorage(): AccessTokenPayload | null {
  const tokens = authStorage.getTokens();
  if (!tokens) return null;
  const payload = decodeAccessToken(tokens.accessToken);
  if (!payload || payload.exp * 1000 < Date.now()) return null;
  return payload;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccessTokenPayload | null>(() => readUserFromStorage());

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login: async (email, password) => {
        const tokens = await apiFetch<{ accessToken: string; refreshToken: string }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        authStorage.setTokens(tokens);
        setUser(decodeAccessToken(tokens.accessToken));
      },
      logout: () => {
        authStorage.setTokens(null);
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return ctx;
}
