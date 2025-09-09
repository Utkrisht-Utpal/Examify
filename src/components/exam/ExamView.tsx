import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Edit, 
  Eye, 
  Play, 
  Pause, 
  Users, 
  Clock, 
  FileText, 
  BarChart3,
  Download,
  Settings,
  Calendar,
  CheckCircle,
  XCircle
} from "lucide-react";

interface ExamViewProps {
  examId: string;
  onBack: () => void;
  onEdit: () => void;
  onViewResults: () => void;
}

interface ExamData {
  id: string;
  title: string;
  subject: string;
  duration: number;
  totalQuestions: number;
  totalPoints: number;
  passingScore: number;
  status: "draft" | "active" | "completed" | "paused";
  createdDate: string;
  startDate?: string;
  endDate?: string;
  instructions: string;
  studentsEnrolled: number;
  studentsCompleted: number;
  averageScore: number;
  questions: {
    id: string;
    type: "mcq" | "descriptive";
    text: string;
    options?: string[];
    correctAnswer?: string;
    points: number;
  }[];
  submissions: {
    studentName: string;
    score: number;
    percentage: number;
    submittedAt: string;
    timeSpent: string;
    status: "completed" | "in-progress";
  }[];
}

export const ExamView = ({ examId, onBack, onEdit, onViewResults }: ExamViewProps) => {
  // Sample exam data
  const [examData] = useState<ExamData>({
    id: examId,
    title: "Mathematics Final Exam",
    subject: "Mathematics", 
    duration: 120,
    totalQuestions: 5,
    totalPoints: 100,
    passingScore: 60,
    status: "active",
    createdDate: "2024-01-15",
    startDate: "2024-01-20 10:00",
    endDate: "2024-01-20 12:00",
    instructions: "Read all questions carefully before answering. You have 120 minutes to complete this exam. Make sure to manage your time effectively.",
    studentsEnrolled: 45,
    studentsCompleted: 23,
    averageScore: 75.5,
    questions: [
      {
        id: "1",
        type: "mcq",
        text: "What is the derivative of x² + 3x + 2?",
        options: ["2x + 3", "x² + 3", "2x + 2", "3x + 2"],
        correctAnswer: "2x + 3",
        points: 20
      },
      {
        id: "2",
        type: "mcq", 
        text: "If f(x) = sin(x), what is f'(x)?",
        options: ["cos(x)", "-cos(x)", "sin(x)", "-sin(x)"],
        correctAnswer: "cos(x)",
        points: 20
      },
      {
        id: "3",
        type: "descriptive",
        text: "Explain the fundamental theorem of calculus and provide an example of its application.",
        points: 30
      },
      {
        id: "4",
        type: "mcq",
        text: "What is the integral of 2x dx?",
        options: ["x²", "x² + C", "2x²", "2x² + C"],
        correctAnswer: "x² + C",
        points: 15
      },
      {
        id: "5",
        type: "descriptive", 
        text: "Solve the differential equation dy/dx = 2x and explain your solution method.",
        points: 15
      }
    ],
    submissions: [
      { studentName: "Alice Johnson", score: 95, percentage: 95, submittedAt: "2024-01-20 11:20", timeSpent: "1h 20m", status: "completed" },
      { studentName: "Bob Smith", score: 88, percentage: 88, submittedAt: "2024-01-20 11:45", timeSpent: "1h 45m", status: "completed" },
      { studentName: "Carol Davis", score: 82, percentage: 82, submittedAt: "2024-01-20 11:30", timeSpent: "1h 30m", status: "completed" },
      { studentName: "David Wilson", score: 0, percentage: 0, submittedAt: "", timeSpent: "45m", status: "in-progress" },
      { studentName: "Emma Brown", score: 70, percentage: 70, submittedAt: "2024-01-20 11:40", timeSpent: "1h 40m", status: "completed" }
    ]
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-success text-success-foreground";
      case "completed": return "bg-primary text-primary-foreground";
      case "paused": return "bg-warning text-warning-foreground";
      case "draft": return "bg-muted text-muted-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <Play className="h-4 w-4" />;
      case "completed": return <CheckCircle className="h-4 w-4" />;
      case "paused": return <Pause className="h-4 w-4" />;
      case "draft": return <Edit className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const completionRate = (examData.studentsCompleted / examData.studentsEnrolled) * 100;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold">{examData.title}</h1>
              <Badge className={`${getStatusColor(examData.status)} flex items-center gap-1`}>
                {getStatusIcon(examData.status)}
                {examData.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">{examData.subject} • Created on {examData.createdDate}</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Exam
          </Button>
          <Button onClick={onViewResults}>
            <BarChart3 className="h-4 w-4 mr-2" />
            View Analytics
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enrolled Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{examData.studentsEnrolled}</div>
            <Progress value={completionRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {examData.studentsCompleted} completed ({completionRate.toFixed(0)}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{examData.averageScore}%</div>
            <p className="text-xs text-muted-foreground">
              Passing score: {examData.passingScore}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{examData.duration}min</div>
            <p className="text-xs text-muted-foreground">
              {examData.totalQuestions} questions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Points</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{examData.totalPoints}</div>
            <p className="text-xs text-muted-foreground">
              Max possible score
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Exam Schedule */}
      {examData.startDate && examData.endDate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Exam Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Start Time</p>
                <p className="text-lg font-semibold">{examData.startDate}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">End Time</p>
                <p className="text-lg font-semibold">{examData.endDate}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Exam Details</TabsTrigger>
          <TabsTrigger value="questions">Questions ({examData.questions.length})</TabsTrigger>
          <TabsTrigger value="submissions">Submissions ({examData.studentsCompleted})</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Instructions</CardTitle>
              <CardDescription>Student guidelines for taking this exam</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-lg">
                <p className="whitespace-pre-line">{examData.instructions}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions">
          <Card>
            <CardHeader>
              <CardTitle>Question Bank</CardTitle>
              <CardDescription>Review all questions in this exam</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {examData.questions.map((question, index) => (
                  <div key={question.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Question {index + 1}</span>
                        <Badge variant="outline">{question.type.toUpperCase()}</Badge>
                        <Badge variant="secondary">{question.points} points</Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <p className="font-medium">{question.text}</p>
                      
                      {question.type === "mcq" && question.options && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Options:</p>
                          <div className="grid gap-2">
                            {question.options.map((option, optIndex) => (
                              <div 
                                key={optIndex} 
                                className={`text-sm p-2 rounded border ${
                                  option === question.correctAnswer 
                                    ? 'bg-success/20 border-success text-success-foreground' 
                                    : 'bg-muted'
                                }`}
                              >
                                {String.fromCharCode(65 + optIndex)}. {option}
                                {option === question.correctAnswer && (
                                  <CheckCircle className="inline h-4 w-4 ml-2" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submissions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Student Submissions</CardTitle>
                <CardDescription>Track individual student progress and scores</CardDescription>
              </div>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {examData.submissions.map((submission, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{submission.studentName}</p>
                        <Badge variant={submission.status === "completed" ? "default" : "secondary"}>
                          {submission.status === "completed" ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <Clock className="h-3 w-3 mr-1" />
                          )}
                          {submission.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {submission.status === "completed" ? (
                          <>Submitted: {submission.submittedAt} • Time: {submission.timeSpent}</>
                        ) : (
                          <>In progress • Time spent: {submission.timeSpent}</>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {submission.status === "completed" ? (
                        <p className="text-lg font-semibold">{submission.score}/{examData.totalPoints}</p>
                      ) : (
                        <p className="text-muted-foreground">-</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {submission.status === "completed" ? `${submission.percentage}%` : "Ongoing"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};