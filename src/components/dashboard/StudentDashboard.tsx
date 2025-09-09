import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Clock, BookOpen, Trophy, TrendingUp, FileText } from "lucide-react";

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
  const [availableExams] = useState([
    {
      id: "1",
      title: "Mathematics Final Exam",
      subject: "Mathematics",
      duration: 120,
      questions: 50,
      startTime: "2024-01-20 10:00",
      endTime: "2024-01-20 12:00",
      status: "available"
    },
    {
      id: "2", 
      title: "Physics Mid-term",
      subject: "Physics",
      duration: 90,
      questions: 40,
      startTime: "2024-01-22 14:00",
      endTime: "2024-01-22 15:30",
      status: "upcoming"
    },
    {
      id: "3",
      title: "Chemistry Quiz",
      subject: "Chemistry", 
      duration: 30,
      questions: 20,
      startTime: "2024-01-18 09:00",
      endTime: "2024-01-18 09:30",
      status: "completed"
    }
  ]);

  const [recentResults] = useState([
    { exam: "Biology Test", score: 85, maxScore: 100, date: "2024-01-15" },
    { exam: "English Essay", score: 92, maxScore: 100, date: "2024-01-12" },
    { exam: "History Quiz", score: 78, maxScore: 100, date: "2024-01-10" }
  ]);

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
              {availableExams.filter(e => e.status === "available").length}
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
              {availableExams.filter(e => e.status === "completed").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">85%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {availableExams.filter(e => e.status === "upcoming").length}
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
                      {exam.questions} questions
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {exam.startTime} - {exam.endTime}
                  </p>
                </div>
                <div>
                  {exam.status === "available" && (
                    <Button onClick={() => onStartExam(exam.id)}>
                      Start Exam
                    </Button>
                  )}
                  {exam.status === "upcoming" && (
                    <Button variant="secondary" disabled>
                      Not Started
                    </Button>
                  )}
                  {exam.status === "completed" && (
                    <Button variant="outline" onClick={onViewResults}>
                      View Result
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Results */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Results</CardTitle>
          <CardDescription>Your latest exam performances</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentResults.map((result, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">{result.exam}</p>
                  <p className="text-sm text-muted-foreground">{result.date}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="font-semibold">{result.score}/{result.maxScore}</p>
                  <Progress value={(result.score / result.maxScore) * 100} className="w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};