import { useAuth } from "@/hooks/useAuth";
import Auth from "./Auth";

const Login = () => {
  const { signIn, signUp } = useAuth();
  return <Auth signIn={signIn} signUp={signUp} />;
};

export default Login;
