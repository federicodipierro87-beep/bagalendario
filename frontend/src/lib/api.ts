// Client HTTP verso il backend (VITE_API_URL). Gestisce token JWT ed errori in italiano.

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'bagalendario.token';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage non disponibile (es. navigazione privata): la sessione dura fino al refresh.
  }
}

let onUnauthorized: (() => void) | null = null;
/** Registra il callback chiamato quando il backend risponde 401 (sessione scaduta). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

type Query = Record<string, string | number | boolean | string[] | null | undefined>;

function buildUrl(path: string, query?: Query) {
  const url = new URL(API_URL + path);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) url.searchParams.set(key, value.join(','));
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'VITE_API_URL non configurata');

  const token = getToken();
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Impossibile contattare il server. Controlla la connessione.');
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token && path !== '/auth/login') onUnauthorized?.();
    throw new ApiError(res.status, data?.error ?? `Errore ${res.status}`, data?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
};

/** Messaggio leggibile da un errore qualsiasi, con i dettagli di validazione se presenti. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (Array.isArray(err.details)) {
      const campi = err.details
        .map((d: { campo?: string; messaggio?: string }) => (d.campo ? `${d.campo}: ${d.messaggio}` : d.messaggio))
        .filter(Boolean);
      if (campi.length) return `${err.message} — ${campi.join('; ')}`;
    }
    return err.message;
  }
  return err instanceof Error ? err.message : 'Errore imprevisto';
}

export const apiBaseUrl = API_URL;
