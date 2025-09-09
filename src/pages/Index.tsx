import { useState } from "react";
import Auth from "./Auth";
import { Header } from "@/components/layout/Header";
import { StudentDashboard } from "@/components/dashboard/StudentDashboard";
import { TeacherDashboard } from "@/components/dashboard/TeacherDashboard";
import { ExamInterface } from "@/components/exam/ExamInterface";
import { ResultsView } from "@/components/results/ResultsView";
import { ExamCreator } from "@/components/exam/ExamCreator";
import { ExamView } from "@/components/exam/ExamView";
import { useToast } from "@/hooks/use-toast";

interface User {
  name: string;
  email: string;
  role: string;
}

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<"dashboard" | "exam" | "results" | "create-exam" | "view-exam">("dashboard");
  const [currentExamId, setCurrentExamId] = useState<string | null>(null);
  const [examResults, setExamResults] = useState<any>(null);
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

  const handleSubmitExam = (results: any) => {
    console.log("Exam submitted with results:", results);
    setExamResults(results);
    setCurrentView("results");
    setCurrentExamId(null);
    toast({
      title: "Exam Submitted",
      description: `Your exam has been submitted! Score: ${results.totalScore}/${results.maxScore} (${results.percentage}%)`,
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
    setCurrentView("create-exam");
    toast({
      title: "Create Exam",
      description: "Opening exam creation interface...",
    });
  };

  const handleViewExam = (examId: string) => {
    setCurrentExamId(examId);
    setCurrentView("view-exam");
  };

  const handleBackToDashboard = () => {
    setCurrentView("dashboard");
    setCurrentExamId(null);
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

  if (currentView === "results") {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} onLogout={handleLogout} />
        <ResultsView user={user} onBack={handleBackToDashboard} />
      </div>
    );
  }

  if (currentView === "create-exam") {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} onLogout={handleLogout} />
        <ExamCreator onBack={handleBackToDashboard} />
      </div>
    );
  }

  if (currentView === "view-exam" && currentExamId) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} onLogout={handleLogout} />
        <ExamView 
          examId={currentExamId}
          onBack={handleBackToDashboard}
          onEdit={() => setCurrentView("create-exam")}
          onViewResults={handleViewResults}
        />
      </div>
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
