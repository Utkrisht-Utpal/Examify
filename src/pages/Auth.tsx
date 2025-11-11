import { useState } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { BookOpen, GraduationCap, Shield, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuthProps {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<void>;
}

const Auth = ({ signIn, signUp }: AuthProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const { toast } = useToast();

  const handleLogin = async (email: string, password: string) => {
    try {
      await signIn(email, password);
      toast({
        title: "Login Successful",
        description: `Welcome back!`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Invalid email or password. Please check your credentials and try again.";
      console.error('Login error details:', error);
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleRegister = async (email: string, password: string, name: string, role: string) => {
    // Password validation
    if (password.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    try {
      await signUp(email, password, name, role);
      toast({
        title: "Registration Successful",
        description: `Welcome, ${name}! You can now sign in.`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Registration failed";
      toast({
        title: "Registration Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="flex min-h-screen">
        {/* Left side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-primary text-primary-foreground p-12 flex-col justify-center">
          <div className="max-w-md">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground text-primary">
                <BookOpen className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-bold">Examify</h1>
            </div>
            
            <h2 className="text-4xl font-bold mb-6">
              Modern Online Examination System
            </h2>
            
            <p className="text-xl opacity-90 mb-8">
              Secure, scalable, and user-friendly platform for conducting online examinations with real-time monitoring and analytics.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success text-success-foreground">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <span className="text-lg">Students can take exams with real-time timer</span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Users className="h-4 w-4" />
                </div>
                <span className="text-lg">Teachers can create and manage exams</span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning text-warning-foreground">
                  <Shield className="h-4 w-4" />
                </div>
                <span className="text-lg">Administrators can monitor all activities</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Auth Form */}
        <div className="flex w-full lg:w-1/2 items-center justify-center p-6">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center lg:hidden mb-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <BookOpen className="h-5 w-5" />
                </div>
                <span className="text-2xl font-bold">Examify</span>
              </div>
              <p className="text-muted-foreground">Online Examination System</p>
            </div>

            {isLogin ? (
              <LoginForm 
                onLogin={handleLogin} 
                onSwitchToRegister={() => setIsLogin(false)} 
              />
            ) : (
              <RegisterForm 
                onRegister={handleRegister} 
                onSwitchToLogin={() => setIsLogin(true)} 
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;