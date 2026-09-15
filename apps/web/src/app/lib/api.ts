// HTTP-клиент Saba API: токены, авто-refresh, типизированные ошибки

const BASE = `${import.meta.env.BASE_URL}api/v1`;

let accessToken: string | null = localStorage.getItem('saba_access');
let refreshToken: string | null = localStorage.getItem('saba_refresh');

export function setTokens(access: string | null, refresh: string | null) {
  accessToken = access;
  refreshToken = refresh;
  if (access) localStorage.setItem('saba_access', access);
  else localStorage.removeItem('saba_access');
  if (refresh) localStorage.setItem('saba_refresh', refresh);
  else localStorage.removeItem('saba_refresh');
}

export function hasTokens() {
  return Boolean(accessToken);
}

// ── Режим «войти как компания»: токены супер-админа прячем в бэкап ──
const SUPER_BACKUP = 'saba_super_backup';

export function startImpersonation(access: string, refresh: string) {
  localStorage.setItem(
    SUPER_BACKUP,
    JSON.stringify({ access: localStorage.getItem('saba_access'), refresh: localStorage.getItem('saba_refresh') }),
  );
  setTokens(access, refresh);
}

export const isImpersonating = () => localStorage.getItem(SUPER_BACKUP) !== null;

export function stopImpersonation(): boolean {
  const raw = localStorage.getItem(SUPER_BACKUP);
  localStorage.removeItem(SUPER_BACKUP);
  if (!raw) return false;
  const { access, refresh } = JSON.parse(raw);
  setTokens(access, refresh);
  return true;
}

export const clearImpersonation = () => localStorage.removeItem(SUPER_BACKUP);

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        setTokens(data.accessToken, data.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  const doFetch = () =>
    fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

  let res = await doFetch();
  if (res.status === 401 && auth && refreshToken) {
    const ok = await tryRefresh();
    if (ok) res = await doFetch();
  }
  if (!res.ok) {
    let message = `Ошибка ${res.status}`;
    try {
      const data = await res.json();
      message = Array.isArray(data.message) ? data.message.join(', ') : (data.message ?? message);
    } catch { /* ignore */ }
    if (res.status === 401) setTokens(null, null);
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const apiGet = <T = any>(path: string) => api<T>(path);
export const apiPost = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body });
export const apiPatch = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body });
export const apiDelete = <T = any>(path: string) => api<T>(path, { method: 'DELETE' });

// публичные (виджет)
export const apiPublic = <T = any>(path: string) => api<T>(path, { auth: false });
export const apiPublicPost = <T = any>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body, auth: false });

// ── Клиентский портал: отдельный токен в localStorage (ключ на slug) ──
const clientKey = (slug: string) => `saba_client_token:${slug}`;
export const getClientToken = (slug: string) => localStorage.getItem(clientKey(slug));
export function setClientToken(slug: string, token: string | null) {
  if (token) localStorage.setItem(clientKey(slug), token);
  else localStorage.removeItem(clientKey(slug));
}

export async function clientApi<T = any>(
  slug: string,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { method = 'GET', body } = options;
  const token = getClientToken(slug);
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    let message = `Ошибка ${res.status}`;
    try {
      const data = await res.json();
      message = Array.isArray(data.message) ? data.message.join(', ') : (data.message ?? message);
    } catch { /* ignore */ }
    if (res.status === 401) setClientToken(slug, null);
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
