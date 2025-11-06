import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Clock, BookOpen, Trophy, TrendingUp, FileText } from "lucide-react";
import { useExams } from "@/hooks/useExams";
import { useResults } from "@/hooks/useResults";
import { supabase } from "@/integrations/supabase/client";

interface StudentDashboardProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
  onStartExam: (examId: string) => void;
  onViewResults: () => void;
}

export const StudentDashboard = ({ user, onStartExam, onViewResults }: StudentDashboardProps) => {
  const { exams, isLoading: examsLoading } = useExams();
  
  // Get current user ID from Supabase
  const [userId, setUserId] = React.useState<string | null>(null);
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);
  
  const { results, isLoading: resultsLoading } = useResults(userId || undefined);

  const availableExams = exams?.filter(exam => exam.status === 'published') || [];
  
  // Helper function to get exam availability status
  const getExamStatus = (exam: any) => {
    const now = new Date();
    const startTime = exam.start_time ? new Date(exam.start_time) : null;
    const endTime = exam.end_time ? new Date(exam.end_time) : null;
    
    if (startTime && startTime > now) {
      return { status: 'upcoming', label: 'Upcoming', canStart: false };
    }
    
    if (endTime && exam.auto_close && endTime < now) {
      return { status: 'ended', label: 'Ended', canStart: false };
    }
    
    return { status: 'available', label: 'Available', canStart: true };
  };
  
  const recentResults = results?.slice(0, 3) || [];
  
  // Separate exams by status
  const activeExams = availableExams.filter(exam => getExamStatus(exam).canStart);
  const upcomingExams = availableExams.filter(exam => getExamStatus(exam).status === 'upcoming');

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-success text-success-foreground";
      case "upcoming":
        return "bg-warning text-warning-foreground";
      case "ended":
        return "bg-destructive text-destructive-foreground";
      case "completed":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {user.name.split(' ')[0]}!</h1>
          <p className="text-muted-foreground">Ready to ace your next exam?</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={onViewResults} variant="outline">
            <Trophy className="h-4 w-4 mr-2" />
            View Results
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Exams</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {activeExams.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {results?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {results && results.length > 0 
                ? Math.round(results.reduce((acc, r) => acc + r.percentage, 0) / results.length)
                : 0}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {upcomingExams.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Exams */}
      <Card>
        <CardHeader>
          <CardTitle>Available Exams</CardTitle>
          <CardDescription>Exams you can take right now</CardDescription>
        </CardHeader>
        <CardContent>
          {examsLoading ? (
            <p className="text-center text-muted-foreground py-4">Loading exams...</p>
          ) : availableExams.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No exams available</p>
          ) : (
            <div className="space-y-4">
              {availableExams.map((exam) => {
                const examStatus = getExamStatus(exam);
                return (
                  <div key={exam.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{exam.title}</h3>
                        <Badge className={getStatusColor(examStatus.status)}>
                          {examStatus.label}
                        </Badge>
                        {!exam.is_timed && (
                          <Badge variant="outline">Untimed</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {exam.subject}
                        </div>
                        {exam.is_timed && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {exam.duration} mins
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {exam.total_marks} marks
                        </div>
                      </div>
                      {exam.start_time && examStatus.status === 'upcoming' && (
                        <p className="text-xs text-muted-foreground">
                          Available from: {new Date(exam.start_time).toLocaleString()}
                        </p>
                      )}
                      {exam.end_time && examStatus.canStart && (
                        <p className="text-xs text-muted-foreground">
                          {exam.auto_close ? 'Closes at' : 'Ends at'}: {new Date(exam.end_time).toLocaleString()}
                        </p>
                      )}
                      {examStatus.status === 'ended' && (
                        <p className="text-xs text-destructive">
                          This exam has ended
                        </p>
                      )}
                    </div>
                    <div>
                      <Button 
                        onClick={() => onStartExam(exam.id)}
                        disabled={!examStatus.canStart}
                      >
                        {examStatus.status === 'upcoming' ? 'Not Yet Available' : examStatus.status === 'ended' ? 'Exam Ended' : 'Start Exam'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Results */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Results</CardTitle>
          <CardDescription>Your latest exam performances</CardDescription>
        </CardHeader>
        <CardContent>
          {resultsLoading ? (
            <p className="text-center text-muted-foreground py-4">Loading results...</p>
          ) : recentResults.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No results yet</p>
          ) : (
            <div className="space-y-4">
              {recentResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{result.exams?.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(result.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-semibold">{result.score}/{result.total_marks}</p>
                    <Progress value={result.percentage} className="w-24" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};