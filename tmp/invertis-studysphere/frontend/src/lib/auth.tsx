import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Settings, User } from './types';

interface Session {
  user: User;
  permissions: string[] | 'ALL';
  isStaff: boolean;
}

interface AuthCtx {
  user: User | null;
  isStaff: boolean;
  loading: boolean;
  settings: Settings | null;
  can: (perm: string) => boolean;
  login: (email: string, password: string, admin?: boolean) => Promise<Session>;
  register: (data: { name: string; email: string; password: string; enrollmentNo?: string }) => Promise<any>;
  logout: () => Promise<void>;
  applySession: (s: Session) => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSession(await api.get<Session>('/auth/me'));
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([refresh(), api.get<Settings>('/public/settings').then(setSettings).catch(() => {})]);
      setLoading(false);
    })();
  }, [refresh]);

  const value = useMemo<AuthCtx>(
    () => ({
      user: session?.user ?? null,
      isStaff: Boolean(session?.isStaff),
      loading,
      settings,
      can: (perm) => Boolean(session && (session.permissions === 'ALL' || session.permissions.includes(perm))),
      login: async (email, password, admin) => {
        const s = await api.post<Session>(admin ? '/auth/admin-login' : '/auth/login', { email, password });
        setSession(s);
        return s;
      },
      register: async (data) => {
        const r = await api.post('/auth/register', data);
        if (r.user) setSession({ user: r.user, permissions: r.permissions, isStaff: r.isStaff });
        return r;
      },
      logout: async () => {
        await api.post('/auth/logout').catch(() => {});
        setSession(null);
      },
      applySession: setSession,
      refresh,
    }),
    [session, loading, settings, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}
