import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Auth from "./Auth";

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user, loading } = useAuth();
  // If already authenticated (or once authentication completes), go to dashboard

  // If already authenticated (or once authentication completes), go to dashboard
  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [loading, user, navigate]);

  return <Auth signIn={signIn} signUp={signUp} />;
};

export default Login;
