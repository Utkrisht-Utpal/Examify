import { useState } from "react";
import Auth from "./Auth";
import { Header } from "@/components/layout/Header";
import { StudentDashboard } from "@/components/dashboard/StudentDashboard";
import { TeacherDashboard } from "@/components/dashboard/TeacherDashboard";
import { ExamInterface } from "@/components/exam/ExamInterface";
import { useToast } from "@/hooks/use-toast";

interface User {
  name: string;
  email: string;
  role: string;
}

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<"dashboard" | "exam" | "results">("dashboard");
  const [currentExamId, setCurrentExamId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleLogin = (role: string, email: string, name?: string) => {
    setUser({
      name: name || email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      email,
      role
    });
    toast({
      title: "Login Successful",
      description: `Welcome back, ${name || 'User'}!`,
    });
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView("dashboard");
    setCurrentExamId(null);
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
  };

  const handleStartExam = (examId: string) => {
    setCurrentExamId(examId);
    setCurrentView("exam");
    toast({
      title: "Exam Started",
      description: "Good luck with your examination!",
    });
  };

  const handleSubmitExam = (answers: Record<string, string>) => {
    console.log("Exam submitted with answers:", answers);
    setCurrentView("dashboard");
    setCurrentExamId(null);
    toast({
      title: "Exam Submitted",
      description: "Your answers have been submitted successfully!",
    });
  };

  const handleExitExam = () => {
    setCurrentView("dashboard");
    setCurrentExamId(null);
  };

  const handleViewResults = () => {
    setCurrentView("results");
    toast({
      title: "Results View",
      description: "Viewing examination results and analytics.",
    });
  };

  const handleCreateExam = () => {
    toast({
      title: "Create Exam",
      description: "Opening exam creation interface...",
    });
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  if (currentView === "exam" && currentExamId) {
    return (
      <ExamInterface
        examId={currentExamId}
        onSubmitExam={handleSubmitExam}
        onExitExam={handleExitExam}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onLogout={handleLogout} />
      
      <main>
        {user.role === "student" && (
          <StudentDashboard
            user={user}
            onStartExam={handleStartExam}
            onViewResults={handleViewResults}
          />
        )}
        
        {user.role === "teacher" && (
          <TeacherDashboard
            user={user}
            onCreateExam={handleCreateExam}
            onViewResults={handleViewResults}
          />
        )}
        
        {user.role === "admin" && (
          <div className="p-6">
            <h1 className="text-3xl font-bold mb-4">Admin Dashboard</h1>
            <p className="text-muted-foreground">System administration panel coming soon...</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
