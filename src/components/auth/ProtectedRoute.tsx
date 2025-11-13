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
  if (!initialChecked || loading) {
    console.log('[ProtectedRoute] Waiting for auth initialization...', { initialChecked, loading });
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Also wait for role to be determined before proceeding
  if (user && session && roleLoading) {
    console.log('[ProtectedRoute] Waiting for role to load...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading user data...</p>
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
