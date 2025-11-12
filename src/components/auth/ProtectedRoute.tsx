import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: Props) => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export default ProtectedRoute;