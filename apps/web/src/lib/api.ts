const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function getTokens() {
  const raw = localStorage.getItem('auth');
  return raw ? (JSON.parse(raw) as { accessToken: string; refreshToken: string }) : null;
}

function setTokens(tokens: { accessToken: string; refreshToken: string } | null) {
  if (tokens) localStorage.setItem('auth', JSON.stringify(tokens));
  else localStorage.removeItem('auth');
}

async function refreshAccessToken(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens) return null;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  if (!res.ok) {
    setTokens(null);
    return null;
  }
  const newTokens = await res.json();
  setTokens(newTokens);
  return newTokens.accessToken;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const tokens = getTokens();

  const doFetch = (accessToken?: string) =>
    fetch(`${API_URL}${path}`, {
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
    if (newAccessToken) {
      response = await doFetch(newAccessToken);
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(body.message ?? 'Erro na requisição.');
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const authStorage = { getTokens, setTokens };
