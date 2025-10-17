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
  const recentResults = results?.slice(0, 3) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-success text-success-foreground";
      case "upcoming":
        return "bg-warning text-warning-foreground";
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
              {availableExams.length}
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
              {availableExams.filter(e => e.scheduled_at && new Date(e.scheduled_at) > new Date()).length}
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
              {availableExams.map((exam) => (
                <div key={exam.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{exam.title}</h3>
                      <Badge className={getStatusColor(exam.status)}>
                        {exam.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {exam.subject}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {exam.duration} mins
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {exam.total_marks} marks
                      </div>
                    </div>
                    {exam.scheduled_at && (
                      <p className="text-xs text-muted-foreground">
                        Scheduled: {new Date(exam.scheduled_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div>
                    <Button onClick={() => onStartExam(exam.id)}>
                      Start Exam
                    </Button>
                  </div>
                </div>
              ))}
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