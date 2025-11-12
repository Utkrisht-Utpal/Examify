import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Auth from "./Auth";

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user, loading } = useAuth();
  const [isReady, setIsReady] = useState(false);

  // Clear any stale session on mount
  useEffect(() => {
    const clearStaleSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        // If there's a session but we're on login page, it might be stale
        if (session && !user && !loading) {
          await supabase.auth.signOut();
        }
      } catch (error) {
        // Ignore errors during session check
        console.debug('Session check error:', error);
      }
      setIsReady(true);
    };
    clearStaleSession();
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If already authenticated (or once authentication completes), go to dashboard
  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [loading, user, navigate]);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <Auth signIn={signIn} signUp={signUp} />;
};

export default Login;
