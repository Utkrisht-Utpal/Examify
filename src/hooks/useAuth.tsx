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

  // Ensure a profile row and default role exist for the authenticated user
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

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          setLoading(true);
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            // Ensure profile row exists
            await ensureProfile(session.user.id, session.user.email, (session.user.user_metadata as any)?.full_name);
  
            // Fetch user roles and compute effective role (prefer metadata)
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
            const derived: 'student' | 'teacher' | null = metaRole === 'teacher' ? 'teacher' : metaRole === 'student' ? 'student' : (roleList.includes('teacher') ? 'teacher' : (roleList.includes('student') ? 'student' : null));
            setEffectiveRole(derived);
          } else {
            setRoles([]);
            setEffectiveRole(null);
          }
        } finally {
          setLoading(false);
        }
      }
    );
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
            const derived: 'student' | 'teacher' | null = metaRole === 'teacher' ? 'teacher' : metaRole === 'student' ? 'student' : (roleList.includes('teacher') ? 'teacher' : (roleList.includes('student') ? 'student' : null));
            setEffectiveRole(derived);
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
    const derived: 'student' | 'teacher' | null = metaRole === 'teacher' ? 'teacher' : metaRole === 'student' ? 'student' : (roleList.includes('teacher') ? 'teacher' : (roleList.includes('student') ? 'student' : null));
    setEffectiveRole(derived);
    setLoading(false);
    console.log('Sign in successful:', data.user?.email);
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setRoles([]);
      setEffectiveRole(null);
      setUser(null);
      setSession(null);
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
