import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: string[];
  effectiveRole: 'student' | 'teacher' | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [effectiveRole, setEffectiveRole] = useState<'student' | 'teacher' | null>(null);
  const [loading, setLoading] = useState(true);
  const PROJECT_REF = (import.meta as any)?.env?.VITE_SUPABASE_PROJECT_ID as string | undefined;

  // Ensure a profile row exist for the authenticated user
  const ensureProfile = async (uid: string, email: string | null, fullName?: string | null) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', uid)
        .maybeSingle();
      if (!profile) {
        await supabase.from('profiles').insert({
          id: uid,
          email: email ?? '',
          full_name: fullName || (email ? email.split('@')[0] : 'User')
        });
      }
    } catch (e) {
      console.warn('ensureProfile warning:', e);
    }
  };

  // Derive a stable role using metadata first, then DB roles, then cached registration choice
  const deriveRole = (metaRole: any, dbRoles: string[] | null | undefined, email: string | null | undefined): 'student' | 'teacher' => {
    const m = typeof metaRole === 'string' ? metaRole : undefined;
    if (m === 'teacher' || m === 'student') return m;
    const list = dbRoles || [];
    if (list.includes('teacher')) return 'teacher';
    if (list.includes('student')) return 'student';
    // cache fallback
    try {
      if (email) {
        const cached = localStorage.getItem(`accountRole:${email.toLowerCase()}`);
        if (cached === 'teacher' || cached === 'student') return cached as 'teacher' | 'student';
      }
    } catch {}
    return 'student';
  };

  // Persist role back to auth metadata if needed
  const persistRoleToMetadataIfNeeded = async (currentMeta: any, email: string | null | undefined, role: 'student' | 'teacher') => {
    try {
      const m = typeof currentMeta === 'string' ? currentMeta : undefined;
      if (m !== role) {
        await supabase.auth.updateUser({ data: { role } });
      }
      if (email) {
        try { localStorage.setItem(`accountRole:${email.toLowerCase()}`, role); } catch {}
      }
    } catch (e) {
      // non-fatal
      console.warn('persistRoleToMetadataIfNeeded warning:', e);
    }
  };

  // Best-effort: ensure a user_roles row exists for analytics and DB queries
  const tryEnsureUserRole = async (userId: string, role: 'student' | 'teacher') => {
    try {
      const { data: existing } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      if (!existing || existing.length === 0) {
        await supabase.from('user_roles').insert({ user_id: userId, role }).select().single();
      }
    } catch (e) {
      // Ignore if RLS disallows inserts; metadata role continues to be the source of truth
      console.warn('tryEnsureUserRole warning:', e);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Always reflect latest session and user
        setSession(session);
        setUser(session?.user ?? null);

        // Handle events with minimal UI disruption
        switch (event) {
          case 'SIGNED_IN': {
            try {
              setLoading(true);
              if (session?.user) {
                await ensureProfile(session.user.id, session.user.email, (session.user.user_metadata as any)?.full_name);
                // Fetch user roles only on sign-in
                let roleList: string[] = [];
                try {
                  const { data: rolesData } = await supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', session.user.id);
                  roleList = (rolesData || []).map(r => r.role);
                  setRoles(roleList);
                } catch {}
                const metaRole = (session.user.user_metadata as any)?.role;
                const derived = deriveRole(metaRole, roleList, session.user.email);
                setEffectiveRole(prev => (prev === 'teacher' ? 'teacher' : derived));
                await persistRoleToMetadataIfNeeded(metaRole, session.user.email, derived);
                if (!roleList || roleList.length === 0) {
                  await tryEnsureUserRole(session.user.id, derived);
                  setRoles([derived]);
                }
              }
            } finally {
              setLoading(false);
            }
            break;
          }
          case 'SIGNED_OUT': {
            // Reset state and redirect to login
            setRoles([]);
            setEffectiveRole(null);
            if (window.location.pathname !== '/login') {
              window.location.replace('/login');
            }
            break;
          }
          case 'TOKEN_REFRESHED':
          case 'USER_UPDATED':
          case 'INITIAL_SESSION':
          default: {
            // Do not toggle loading for token refresh or passive updates; keep current roles/effectiveRole
            break;
          }
        }
      }
    );

    // Check for existing session on mount (network-safe)
    (async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
  
        if (session?.user) {
          try {
            await ensureProfile(session.user.id, session.user.email, (session.user.user_metadata as any)?.full_name);
            const { data: rolesData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id);
            const roleList = (rolesData || []).map(r => r.role);
            setRoles(roleList);
            const metaRole = (session.user.user_metadata as any)?.role;
            const derived = deriveRole(metaRole, roleList, session.user.email);
            setEffectiveRole(prev => (prev === 'teacher' ? 'teacher' : derived));
            await persistRoleToMetadataIfNeeded(metaRole, session.user.email, derived);
            if (!roleList || roleList.length === 0) {
              await tryEnsureUserRole(session.user.id, derived);
              setRoles([derived]);
            }
          } catch {}
        } else {
          setEffectiveRole(null);
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => subscription.unsubscribe();
  }, []);

  // Fallback: never keep the app in loading state indefinitely (e.g., slow network)
  useEffect(() => {
    if (!loading) return;
    const id = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(id);
  }, [loading]);

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    try { localStorage.setItem(`accountRole:${email.toLowerCase()}`, role); } catch {}
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, role }
      }
    });
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('registered') || msg.includes('exists') || msg.includes('email')) {
        throw new Error('This email is already registered. Please sign in instead.');
      }
      throw error;
    }
    // Best-effort: if we already have a session (email confirmation disabled), create role row
    try {
      const { data: s } = await supabase.auth.getSession();
      if (s?.session?.user?.id) {
        await supabase.from('user_roles').insert({ user_id: s.session.user.id, role }).select().single();
      }
    } catch {
      // ignore - metadata role is still persisted
    }
    // No immediate sign-in; user will confirm email then sign in. Role is applied in onAuthStateChange.
  };

  const signIn = async (email: string, password: string) => {
    console.log('Attempting sign in with email:', email);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.error('Sign in error:', error);
      setLoading(false);
      throw error;
    }

    const userId = data.user?.id;
    if (!userId) { setLoading(false); return; }

    // Fetch roles to compute effective role alongside metadata
    let roleList: string[] = [];
    try {
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      roleList = (rolesData || []).map(r => r.role);
      setRoles(roleList);
    } catch {}
    const metaRole = data.user?.user_metadata?.role as string | undefined;
    const derived = deriveRole(metaRole, roleList, data.user?.email || null);
    setEffectiveRole(derived);
    await persistRoleToMetadataIfNeeded(metaRole, data.user?.email || null, derived);
    if (!roleList || roleList.length === 0) {
      await tryEnsureUserRole(userId, derived);
      setRoles([derived]);
    }
    setLoading(false);
    console.log('Sign in successful:', data.user?.email);
  };

  const signOut = async () => {
    // Remove known auth-related storage keys and our cached role
    const clearAuthStorage = () => {
      try {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          const isThisProject = PROJECT_REF ? k.startsWith(`sb-${PROJECT_REF}-`) : k.startsWith('sb-');
          const isAuthToken = /sb-.*-auth-token/i.test(k) || k.includes('supabase.auth.token') || k.includes('supabase.auth.refresh-token');
          if (isThisProject || isAuthToken) keys.push(k);
        }
        keys.forEach(k => localStorage.removeItem(k));
      } catch {}
      try {
        const sKeys: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (!k) continue;
          const isThisProject = PROJECT_REF ? k.startsWith(`sb-${PROJECT_REF}-`) : k.startsWith('sb-');
          const isAuthToken = /sb-.*-auth-token/i.test(k) || k.includes('supabase.auth.token') || k.includes('supabase.auth.refresh-token');
          if (isThisProject || isAuthToken) sKeys.push(k);
        }
        sKeys.forEach(k => sessionStorage.removeItem(k));
      } catch {}
      try {
        if (user?.email) localStorage.removeItem(`accountRole:${user.email.toLowerCase()}`);
      } catch {}
    };

    // Unregister all service workers to prevent cached dashboard HTML
    const unregisterServiceWorkers = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(reg => reg.unregister()));
        }
      } catch {}
    };

    setLoading(true);
    try {
      // Server-side sign out for current device/session
      try { await supabase.auth.signOut(); } catch {}
      // Drop realtime channels to prevent stray reconnects
      try { supabase.removeAllChannels(); } catch {}
      // Clear local auth artifacts
      clearAuthStorage();
      // Unregister service workers
      await unregisterServiceWorkers();
      // Reset state
      setRoles([]);
      setEffectiveRole(null);
      setUser(null);
      setSession(null);
      // Hard redirect to login page (forces full page reload, clearing any SPA state)
      window.location.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, roles, effectiveRole, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
