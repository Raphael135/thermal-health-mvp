import { getApiUrl } from '../config/server';
import { useAuthStore } from '../store/auth-store';

async function refreshAccessToken(): Promise<string | null> {
  const { tokens, setTokens } = useAuthStore.getState();
  if (!tokens) return null;

  const res = await fetch(`${getApiUrl()}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  if (!res.ok) {
    await setTokens(null);
    return null;
  }
  const newTokens = await res.json();
  await setTokens(newTokens);
  return newTokens.accessToken;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { tokens } = useAuthStore.getState();

  const doFetch = (accessToken?: string) =>
    fetch(`${getApiUrl()}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });

  let response = await doFetch(tokens?.accessToken);

  if (response.status === 401 && tokens) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) response = await doFetch(newAccessToken);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(body.message ?? 'Erro na requisição.');
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
