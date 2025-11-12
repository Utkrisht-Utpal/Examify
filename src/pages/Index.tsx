import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Auth from "./Auth";
import { Header } from "@/components/layout/Header";
import { StudentDashboard } from "@/components/dashboard/StudentDashboard";
import { TeacherDashboard } from "@/components/dashboard/TeacherDashboard";
import { ExamInterface } from "@/components/exam/ExamInterface";
import { ResultsView } from "@/components/results/ResultsView";
import { ExamCreator } from "@/components/exam/ExamCreator";
import { ExamView } from "@/components/exam/ExamView";
import { GradingInterface } from "@/components/grading/GradingInterface";
import { useToast } from "@/hooks/use-toast";
import { ErrorBoundary } from "@/components/exam/ErrorBoundary";

interface User {
  name: string;
  email: string;
  role: string;
}

const Index = () => {
  const { user: authUser, signOut, signIn, signUp, loading, roles } = useAuth();
  type ViewType = "dashboard" | "exam" | "results" | "create-exam" | "view-exam" | "grading";
  interface ExamResults {
    totalScore: number;
    maxScore: number;
    correctAnswers: number;
    incorrectAnswers: number;
    percentage: number;
    answers: Record<string, string>;
  }
  
  const [currentView, setCurrentView] = useState<ViewType>("dashboard");
  const [currentExamId, setCurrentExamId] = useState<string | null>(null);
  const [currentSubmissionId, setCurrentSubmissionId] = useState<string | null>(null);
  const [examResults, setExamResults] = useState<ExamResults | null>(null);
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (e) {
      // ignore signout errors; proceed to client reset
    } finally {
      setCurrentView("dashboard");
      setCurrentExamId(null);
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    }
  };

  const handleStartExam = (examId: string) => {
    setCurrentExamId(examId);
    setCurrentView("exam");
    toast({
      title: "Exam Started",
      description: "Good luck with your examination!",
    });
  };

  const handleSubmitExam = (results: ExamResults) => {
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
    setCurrentSubmissionId(null);
  };

  const handleGradeSubmission = (submissionId: string) => {
    setCurrentSubmissionId(submissionId);
    setCurrentView("grading");
    toast({
      title: "Grading",
      description: "Opening grading interface...",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <Auth signIn={signIn} signUp={signUp} />;
  }

  // Get user profile data
  // Determine role strictly from DB roles
  let computedRole = 'student';
  if (roles?.includes('teacher')) computedRole = 'teacher';
  else if (roles?.includes('student')) computedRole = 'student';
  else if (roles?.length) computedRole = roles[0];

  const user: User = {
    name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
    email: authUser.email || '',
    role: computedRole,
  };

  if (currentView === "exam" && currentExamId) {
    console.log('Rendering exam with ID:', currentExamId);
    return (
      <ErrorBoundary onError={handleExitExam}>
        <ExamInterface
          examId={currentExamId}
          onSubmitExam={handleSubmitExam}
          onExitExam={handleExitExam}
        />
      </ErrorBoundary>
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

  if (currentView === "grading" && currentSubmissionId) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} onLogout={handleLogout} />
        <GradingInterface 
          submissionId={currentSubmissionId}
          onBack={handleBackToDashboard}
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
            key={currentView} 
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
            onViewExam={handleViewExam}
            onGradeSubmission={handleGradeSubmission}
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
