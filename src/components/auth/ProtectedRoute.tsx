import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: Props) => {
  const { user, loading, session, initialChecked, roleLoading } = useAuth();
  const navigate = useNavigate();

  // Wait for initial session check to complete before making auth decisions
  if (!initialChecked) {
    console.log('[ProtectedRoute] Waiting for initial session check...', { initialChecked });
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  // If still loading OR role is loading, show spinner
  if (loading || (user && session && roleLoading)) {
    console.log('[ProtectedRoute] Loading auth state...', { loading, roleLoading });
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Use effect to navigate instead of Navigate component to use router.replace
  useEffect(() => {
    if (initialChecked && !loading && (!user || !session)) {
      console.log('[ProtectedRoute] No user/session, redirecting to login');
      navigate('/login', { replace: true });
    }
  }, [initialChecked, loading, user, session, navigate]);
  
  // Redirect to login if no user or session (fallback)
  if (!user || !session) {
    console.log('[ProtectedRoute] No user/session detected');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }
  
  // Render protected content
  return <>{children}</>;
};

export default ProtectedRoute;
