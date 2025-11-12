import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: string[];
  effectiveRole: 'student' | 'teacher' | null;
  loading: boolean;
  authReady: boolean; // NEW: Flag to gate data fetches
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [effectiveRole, setEffectiveRole] = useState<'student' | 'teacher' | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [navigateToLogin, setNavigateToLogin] = useState(false);

  // Derive role from metadata and database
  const deriveRole = (metaRole: unknown, dbRoles: string[], email: string | null): 'student' | 'teacher' => {
    // Priority 1: Metadata
    if (typeof metaRole === 'string' && (metaRole === 'teacher' || metaRole === 'student')) {
      return metaRole;
    }
    // Priority 2: Database roles
    if (dbRoles.includes('teacher')) return 'teacher';
    if (dbRoles.includes('student')) return 'student';
    // Priority 3: localStorage cache
    if (email) {
      const cached = localStorage.getItem(`accountRole:${email.toLowerCase()}`);
      if (cached === 'teacher' || cached === 'student') return cached as 'student' | 'teacher';
    }
    // Default
    return 'student';
  };

  // Ensure profile exists
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
      console.warn('ensureProfile:', e);
    }
  };

  // Load user session and roles
  const loadSession = async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setUser(null);
      setSession(null);
      setRoles([]);
      setEffectiveRole(null);
      console.log('✓ No session - auth ready');
      return;
    }

    const { user: sessionUser } = currentSession;
    setUser(sessionUser);
    setSession(currentSession);

    try {
      // Get role from metadata immediately
      const metaRole = (sessionUser.user_metadata as { role?: string })?.role;
      const quickRole = (metaRole === 'teacher' || metaRole === 'student') ? metaRole : 'student';
      
      // Set role immediately from metadata for fast UI
      setEffectiveRole(quickRole);
      setRoles([quickRole]);
      console.log(`✓ Session loaded. User: ${sessionUser.email}, Role: ${quickRole}`);

      // Background: ensure profile and fetch DB roles
      ensureProfile(sessionUser.id, sessionUser.email, (sessionUser.user_metadata as { full_name?: string })?.full_name)
        .catch(e => console.warn('Background ensureProfile failed:', e));

      // Fetch roles from database
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', sessionUser.id);

      const dbRoles = (rolesData || []).map(r => r.role);
      
      if (dbRoles.length > 0) {
        const derived = deriveRole(metaRole, dbRoles, sessionUser.email);
        setRoles(dbRoles);
        setEffectiveRole(derived);
        console.log(`✓ Roles from DB: ${dbRoles.join(', ')}, Effective: ${derived}`);
      } else {
        // No DB role, create one
        await supabase.from('user_roles')
          .insert({ user_id: sessionUser.id, role: quickRole })
          .select()
          .single()
          .catch(() => console.warn('Could not create user_role'));
      }

      // Cache role
      if (sessionUser.email) {
        localStorage.setItem(`accountRole:${sessionUser.email.toLowerCase()}`, quickRole);
      }

    } catch (error) {
      console.error('Error loading session:', error);
      // Even on error, keep the quick role from metadata
    }
  };

  useEffect(() => {
    let mounted = true;

    // 1. Check for existing session on mount
    (async () => {
      try {
        console.log('Checking for existing session...');
        const { data: { session: existingSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
        }

        if (mounted) {
          await loadSession(existingSession);
          setAuthReady(true);
          setLoading(false);
          console.log('✓ Auth initialization complete. authReady=true');
        }
      } catch (error) {
        console.error('Fatal error in auth init:', error);
        if (mounted) {
          setAuthReady(true);
          setLoading(false);
        }
      }
    })();

    // 2. Set up auth state listener for future changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;
        
        console.log(`Auth event: ${event}, hasSession: ${!!newSession}`);

        switch (event) {
          case 'SIGNED_IN':
          case 'TOKEN_REFRESHED':
          case 'USER_UPDATED':
            await loadSession(newSession);
            break;

          case 'SIGNED_OUT':
            setUser(null);
            setSession(null);
            setRoles([]);
            setEffectiveRole(null);
            console.log('✓ Signed out - auth state cleared');
            
            // Navigate to login if not already there
            if (window.location.pathname !== '/login' && window.location.pathname !== '/logout') {
              setNavigateToLogin(true);
            }
            break;
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    localStorage.setItem(`accountRole:${email.toLowerCase()}`, role);
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, role }
      }
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('registered') || msg.includes('exists')) {
        throw new Error('This email is already registered. Please sign in instead.');
      }
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) throw error;

      // Session will be loaded by onAuthStateChange SIGNED_IN event
      console.log('✓ Sign in successful:', data.user?.email);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      // Clear cached role
      if (user?.email) {
        localStorage.removeItem(`accountRole:${user.email.toLowerCase()}`);
      }

      // Supabase signOut clears tokens from localStorage
      await supabase.auth.signOut();

      // Remove realtime channels
      supabase.removeAllChannels();

      // Local state will be cleared by onAuthStateChange SIGNED_OUT event
      setNavigateToLogin(true);
      
      console.log('✓ Sign out initiated');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        session, 
        roles, 
        effectiveRole, 
        loading, 
        authReady,  // NEW: Expose authReady flag
        signUp, 
        signIn, 
        signOut 
      }}
    >
      <NavigationHandler navigateToLogin={navigateToLogin} setNavigateToLogin={setNavigateToLogin} />
      {children}
    </AuthContext.Provider>
  );
};

// Navigation handler component
const NavigationHandler = ({ 
  navigateToLogin, 
  setNavigateToLogin 
}: { 
  navigateToLogin: boolean; 
  setNavigateToLogin: (val: boolean) => void;
}) => {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (navigateToLogin) {
      setNavigateToLogin(false);
      navigate('/login', { replace: true });
    }
  }, [navigateToLogin, navigate, setNavigateToLogin]);
  
  return null;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
