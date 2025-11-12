import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

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
  const [navigateToLogin, setNavigateToLogin] = useState(false);
  const PROJECT_REF = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env?.VITE_SUPABASE_PROJECT_ID;

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
  const deriveRole = (metaRole: unknown, dbRoles: string[] | null | undefined, email: string | null | undefined): 'student' | 'teacher' => {
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
    } catch (e) {
      /* ignore cache read errors */
    }
    return 'student';
  };

  // Persist role back to auth metadata if needed
  const persistRoleToMetadataIfNeeded = async (currentMeta: unknown, email: string | null | undefined, role: 'student' | 'teacher') => {
    try {
      const m = typeof currentMeta === 'string' ? currentMeta : undefined;
      if (m !== role) {
        await supabase.auth.updateUser({ data: { role } });
      }
      if (email) {
        try { localStorage.setItem(`accountRole:${email.toLowerCase()}`, role); } catch (e) { /* ignore cache write */ }
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
    let mounted = true;
    let initialCheckDone = false;
    
    // Function to load user session and roles
    const loadUserSession = async (session: Session | null) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        try {
          await ensureProfile(session.user.id, session.user.email, (session.user.user_metadata as { full_name?: string })?.full_name);
          // Fetch user roles
          let roleList: string[] = [];
          try {
            const { data: rolesData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id);
            roleList = (rolesData || []).map(r => r.role);
            if (mounted) setRoles(roleList);
          } catch (e) { console.warn('Role fetch error:', e); }
          const metaRole = (session.user.user_metadata as { role?: string })?.role;
          const derived = deriveRole(metaRole, roleList, session.user.email);
          if (mounted) {
            setEffectiveRole(derived);
            console.log('User session loaded, role:', derived);
          }
          await persistRoleToMetadataIfNeeded(metaRole, session.user.email, derived);
          if (!roleList || roleList.length === 0) {
            await tryEnsureUserRole(session.user.id, derived);
            if (mounted) setRoles([derived]);
          }
        } catch (e) {
          console.warn('Error loading user session:', e);
        }
      } else {
        // No session - clear everything
        if (mounted) {
          setRoles([]);
          setEffectiveRole(null);
          console.log('No session found');
        }
      }
    };
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('Auth state change:', event, 'session:', !!session);

        // Handle events
        switch (event) {
          case 'INITIAL_SESSION': {
            // This fires on mount with the current session
            try {
              setLoading(true);
              await loadUserSession(session);
              initialCheckDone = true;
            } finally {
              if (mounted) setLoading(false);
            }
            break;
          }
          case 'SIGNED_IN': {
            try {
              setLoading(true);
              await loadUserSession(session);
            } finally {
              if (mounted) setLoading(false);
            }
            break;
          }
          case 'SIGNED_OUT': {
            // Reset state immediately
            setRoles([]);
            setEffectiveRole(null);
            setUser(null);
            setSession(null);
            setLoading(false);
            // Trigger navigation to login if not already there
            if (window.location.pathname !== '/login' && window.location.pathname !== '/logout') {
              setNavigateToLogin(true);
            }
            break;
          }
          case 'TOKEN_REFRESHED':
          case 'USER_UPDATED':
          default: {
            // For token refresh, just update session/user without reloading everything
            if (mounted) {
              setSession(session);
              setUser(session?.user ?? null);
            }
            break;
          }
        }
      }
    );
    
    // Fallback: if INITIAL_SESSION doesn't fire within 1 second, manually check
    const fallbackTimer = setTimeout(async () => {
      if (!initialCheckDone && mounted) {
        console.warn('INITIAL_SESSION not fired, manually checking session');
        try {
          setLoading(true);
          const { data: { session } } = await supabase.auth.getSession();
          await loadUserSession(session);
        } finally {
          if (mounted) setLoading(false);
        }
      }
    }, 1000);

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  // Fallback: never keep the app in loading state indefinitely (e.g., slow network)
  useEffect(() => {
    if (!loading) return;
    const id = setTimeout(() => {
      console.warn('Auth loading timeout reached - forcing loading to false');
      setLoading(false);
    }, 3000);
    return () => clearTimeout(id);
  }, [loading]);

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    try { localStorage.setItem(`accountRole:${email.toLowerCase()}`, role); } catch (e) { /* ignore cache write */ }
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
    } catch (e) {
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
    } catch (e) { /* ignore role fetch errors */ }
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
    setLoading(true);
    try {
      // Clear cached role
      try {
        if (user?.email) localStorage.removeItem(`accountRole:${user.email.toLowerCase()}`);
      } catch (e) { /* ignore cache delete */ }
      
      // Supabase signOut handles all auth cleanup (tokens, storage, etc.)
      await supabase.auth.signOut();
      
      // Drop realtime channels to prevent stray reconnects
      try { supabase.removeAllChannels(); } catch (e) { /* ignore */ }
      
      // Reset local state
      setRoles([]);
      setEffectiveRole(null);
      setUser(null);
      setSession(null);
      
      // Trigger navigation to login page via React Router
      setNavigateToLogin(true);
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, roles, effectiveRole, loading, signUp, signIn, signOut }}>
      <NavigationHandler navigateToLogin={navigateToLogin} setNavigateToLogin={setNavigateToLogin} />
      {children}
    </AuthContext.Provider>
  );
};

// Navigation handler component to handle logout redirects
const NavigationHandler = ({ navigateToLogin, setNavigateToLogin }: { navigateToLogin: boolean; setNavigateToLogin: (val: boolean) => void }) => {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (navigateToLogin) {
      setNavigateToLogin(false);
      navigate('/login', { replace: true });
    }
  }, [navigateToLogin, navigate, setNavigateToLogin]);
  
  return null;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
