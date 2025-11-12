import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: string[];
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
  const [loading, setLoading] = useState(true);

  // Ensure a profile row and default role exist for the authenticated user
  const ensureProfileAndRole = async (uid: string, email: string | null, fullName?: string | null) => {
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

      const { data: rolesExisting } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', uid);

      // If no roles yet, only auto-assign student when there is no pending role hint.
      let pendingRole: string | null = null;
      try { pendingRole = localStorage.getItem('pendingRole'); } catch {}

      if ((!rolesExisting || rolesExisting.length === 0) && !pendingRole) {
        await supabase.from('user_roles').insert({ user_id: uid, role: 'student' });
      }
    } catch (e) {
      console.warn('ensureProfileAndRole warning:', e);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            // Ensure profile row exists
            await ensureProfileAndRole(session.user.id, session.user.email, (session.user.user_metadata as any)?.full_name);
  
            // Apply any pending role choice from registration (student/teacher)
            try {
              const pendingRole = localStorage.getItem('pendingRole');
              if (pendingRole === 'student' || pendingRole === 'teacher') {
                await supabase
                  .from('user_roles')
                  .insert({ user_id: session.user.id, role: pendingRole })
                  .select()
                  .single();
                localStorage.removeItem('pendingRole');
              }
            } catch {
              // ignore
            }
  
            // Fetch user roles
            try {
              const { data: rolesData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id);
              if (rolesData) setRoles(rolesData.map(r => r.role));
            } catch {}
          } else {
            setRoles([]);
          }
        } finally {
          setLoading(false);
        }
      }
    );

    // Check for existing session on mount (network-safe)
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
  
        if (session?.user) {
          try {
            await ensureProfileAndRole(session.user.id, session.user.email, (session.user.user_metadata as any)?.full_name);
            const { data: rolesData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id);
            if (rolesData) setRoles(rolesData.map(r => r.role));
          } catch {}
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    // Remember selected role; it will be applied on first authenticated session after email confirmation
    try { localStorage.setItem('pendingRole', role); } catch {}

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName }
      }
    });
    if (error) throw error;
    // No immediate sign-in; user will confirm email then sign in. Role is applied in onAuthStateChange.
  };

  const signIn = async (email: string, password: string) => {
    console.log('Attempting sign in with email:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error);
      throw error;
    }
    
    console.log('Sign in successful:', data.user?.email);
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      try { localStorage.removeItem('pendingRole'); } catch {}
      setRoles([]);
      setUser(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, roles, loading, signUp, signIn, signOut }}>
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
