import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

const Logout = () => {
  const { signOut } = useAuth();

  useEffect(() => {
    // signOut now handles redirect to /login via window.location.replace
    signOut();
  }, [signOut]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Signing out...</p>
      </div>
    </div>
  );
};

export default Logout;