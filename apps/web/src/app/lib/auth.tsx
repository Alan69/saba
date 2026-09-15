import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, apiPost, clearImpersonation, hasTokens, setTokens } from './api';

export interface AuthUser {
  id: string;
  phone: string;
  name: string;
  role: 'owner' | 'admin' | 'master' | 'superadmin';
  language: string;
}

export interface AuthCompany {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  phone?: string;
  address?: string;
  city?: string;
  timezone: string;
  language: string;
  plan: 'light' | 'business';
  isTrial: boolean;
  planExpiresAt?: string;
  mode: 'active' | 'read_only' | 'frozen';
  accentColor?: string;
  workingHours: Record<string, { enabled: boolean; start: string; end: string }>;
  carSizes?: { key: 'S' | 'M' | 'L' | 'XL'; label: string; examples: string; enabled: boolean }[];
  wizardStep: number;
  wizardDone: boolean;
}

interface AuthState {
  user: AuthUser | null;
  company: AuthCompany | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<AuthUser>;
  register: (companyName: string, phone: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  refreshCompany: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [company, setCompany] = useState<AuthCompany | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasTokens()) {
      setLoading(false);
      return;
    }
    api('/auth/me')
      .then((data) => {
        setUser(data.user);
        setCompany(data.company);
      })
      .catch(() => setTokens(null, null))
      .finally(() => setLoading(false));
  }, []);

  const applyAuth = (data: any) => {
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    setCompany(data.company);
    return data.user as AuthUser;
  };

  const login = useCallback(async (phone: string, password: string) => {
    return applyAuth(await apiPost('/auth/login', { phone, password }));
  }, []);

  const register = useCallback(
    async (companyName: string, phone: string, password: string, name?: string) => {
      applyAuth(await apiPost('/auth/register', { companyName, phone, password, name }));
    },
    [],
  );

  const logout = useCallback(() => {
    const refresh = localStorage.getItem('saba_refresh');
    if (refresh) apiPost('/auth/logout', { refreshToken: refresh }).catch(() => {});
    clearImpersonation();
    setTokens(null, null);
    setUser(null);
    setCompany(null);
  }, []);

  const refreshCompany = useCallback(async () => {
    const data = await api('/company');
    setCompany(data);
  }, []);

  return (
    <AuthContext.Provider value={{ user, company, loading, login, register, logout, refreshCompany }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
