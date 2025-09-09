import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Trophy, 
  Clock, 
  CheckCircle, 
  XCircle, 
  BarChart3,
  TrendingUp,
  Users,
  Calendar,
  Download
} from "lucide-react";

interface ResultsViewProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
  onBack: () => void;
}

interface StudentResult {
  examId: string;
  examTitle: string;
  subject: string;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unanswered: number;
  score: number;
  maxScore: number;
  percentage: number;
  timeSpent: string;
  submittedAt: string;
  rank: number;
  totalStudents: number;
  questionAnalysis: {
    questionId: string;
    question: string;
    yourAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    timeSpent: string;
  }[];
}

interface TeacherAnalytics {
  examId: string;
  examTitle: string;
  subject: string;
  totalStudents: number;
  completedStudents: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  averageTime: string;
  difficultyAnalysis: {
    questionId: string;
    question: string;
    correctRate: number;
    averageTime: string;
    difficulty: "easy" | "medium" | "hard";
  }[];
  studentPerformance: {
    studentName: string;
    score: number;
    percentage: number;
    timeSpent: string;
    submittedAt: string;
  }[];
}

export const ResultsView = ({ user, onBack }: ResultsViewProps) => {
  // Sample student results data
  const [studentResults] = useState<StudentResult[]>([
    {
      examId: "1",
      examTitle: "Mathematics Final Exam",
      subject: "Mathematics", 
      totalQuestions: 5,
      correctAnswers: 4,
      incorrectAnswers: 1,
      unanswered: 0,
      score: 80,
      maxScore: 100,
      percentage: 80,
      timeSpent: "1h 25m",
      submittedAt: "2024-01-20 11:25",
      rank: 12,
      totalStudents: 45,
      questionAnalysis: [
        {
          questionId: "1",
          question: "What is the derivative of x² + 3x + 2?",
          yourAnswer: "2x + 3",
          correctAnswer: "2x + 3", 
          isCorrect: true,
          timeSpent: "2m 15s"
        },
        {
          questionId: "2",
          question: "If f(x) = sin(x), what is f'(x)?",
          yourAnswer: "cos(x)",
          correctAnswer: "cos(x)",
          isCorrect: true,
          timeSpent: "1m 45s"
        },
        {
          questionId: "3", 
          question: "Explain the fundamental theorem of calculus...",
          yourAnswer: "The fundamental theorem connects differentiation and integration...",
          correctAnswer: "Full explanation of fundamental theorem...",
          isCorrect: true,
          timeSpent: "15m 30s"
        },
        {
          questionId: "4",
          question: "What is the integral of 2x dx?",
          yourAnswer: "x² + C",
          correctAnswer: "x² + C",
          isCorrect: true,
          timeSpent: "3m 20s"
        },
        {
          questionId: "5",
          question: "Solve the differential equation dy/dx = 2x...",
          yourAnswer: "y = x² + C (incomplete solution)",
          correctAnswer: "y = x² + C with detailed steps...",
          isCorrect: false,
          timeSpent: "12m 45s"
        }
      ]
    }
  ]);

  // Sample teacher analytics data
  const [teacherAnalytics] = useState<TeacherAnalytics[]>([
    {
      examId: "1",
      examTitle: "Mathematics Final Exam", 
      subject: "Mathematics",
      totalStudents: 45,
      completedStudents: 42,
      averageScore: 75.5,
      highestScore: 95,
      lowestScore: 45,
      averageTime: "1h 35m",
      difficultyAnalysis: [
        {
          questionId: "1",
          question: "What is the derivative of x² + 3x + 2?",
          correctRate: 85,
          averageTime: "2m 30s",
          difficulty: "easy"
        },
        {
          questionId: "2", 
          question: "If f(x) = sin(x), what is f'(x)?",
          correctRate: 78,
          averageTime: "2m 15s",
          difficulty: "medium"
        },
        {
          questionId: "3",
          question: "Explain the fundamental theorem of calculus...", 
          correctRate: 65,
          averageTime: "18m 20s",
          difficulty: "hard"
        },
        {
          questionId: "4",
          question: "What is the integral of 2x dx?",
          correctRate: 82,
          averageTime: "3m 45s", 
          difficulty: "medium"
        },
        {
          questionId: "5",
          question: "Solve the differential equation dy/dx = 2x...",
          correctRate: 55,
          averageTime: "15m 10s",
          difficulty: "hard"
        }
      ],
      studentPerformance: [
        { studentName: "Alice Johnson", score: 95, percentage: 95, timeSpent: "1h 20m", submittedAt: "2024-01-20 11:20" },
        { studentName: "Bob Smith", score: 88, percentage: 88, timeSpent: "1h 45m", submittedAt: "2024-01-20 11:45" },
        { studentName: "Carol Davis", score: 82, percentage: 82, timeSpent: "1h 30m", submittedAt: "2024-01-20 11:30" },
        { studentName: "David Wilson", score: 75, percentage: 75, timeSpent: "1h 55m", submittedAt: "2024-01-20 11:55" },
        { studentName: "Emma Brown", score: 70, percentage: 70, timeSpent: "1h 40m", submittedAt: "2024-01-20 11:40" }
      ]
    }
  ]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy": return "bg-success text-success-foreground";
      case "medium": return "bg-warning text-warning-foreground"; 
      case "hard": return "bg-destructive text-destructive-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return "text-success";
    if (percentage >= 70) return "text-primary";
    if (percentage >= 50) return "text-warning";
    return "text-destructive";
  };

  if (user.role === "student") {
    const result = studentResults[0]; // For demo, show first result

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Exam Results</h1>
            <p className="text-muted-foreground">Detailed performance analysis</p>
          </div>
        </div>

        {/* Score Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Final Score</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(result.percentage)}`}>
                {result.score}/{result.maxScore}
              </div>
              <p className="text-xs text-muted-foreground">
                {result.percentage}% - Rank {result.rank}/{result.totalStudents}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Correct</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{result.correctAnswers}</div>
              <p className="text-xs text-muted-foreground">
                {((result.correctAnswers / result.totalQuestions) * 100).toFixed(0)}% accuracy
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Incorrect</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{result.incorrectAnswers}</div>
              <p className="text-xs text-muted-foreground">
                {result.unanswered} unanswered
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Time Spent</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{result.timeSpent}</div>
              <p className="text-xs text-muted-foreground">
                Submitted on {result.submittedAt}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Question Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Question-wise Analysis</CardTitle>
            <CardDescription>Detailed breakdown of your answers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {result.questionAnalysis.map((question, index) => (
                <div key={question.questionId} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Question {index + 1}</span>
                      {question.isCorrect ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <Badge variant="outline" className="text-xs">
                        {question.timeSpent}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm mb-1">Question:</p>
                      <p className="text-sm text-muted-foreground">{question.question}</p>
                    </div>
                    
                    <div>
                      <p className="font-medium text-sm mb-1">Your Answer:</p>
                      <p className={`text-sm ${question.isCorrect ? 'text-success' : 'text-destructive'}`}>
                        {question.yourAnswer}
                      </p>
                    </div>
                    
                    {!question.isCorrect && (
                      <div>
                        <p className="font-medium text-sm mb-1">Correct Answer:</p>
                        <p className="text-sm text-success">{question.correctAnswer}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Teacher Analytics View
  const analytics = teacherAnalytics[0]; // For demo, show first analytics

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Analytics & Results</h1>
            <p className="text-muted-foreground">Comprehensive exam performance analysis</p>
          </div>
        </div>
        <Button>
          <Download className="h-4 w-4 mr-2" />
          Export Results
        </Button>
      </div>

      {/* Analytics Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.completedStudents}/{analytics.totalStudents}
            </div>
            <Progress value={(analytics.completedStudents / analytics.totalStudents) * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{analytics.averageScore}%</div>
            <p className="text-xs text-muted-foreground">
              Range: {analytics.lowestScore}% - {analytics.highestScore}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.averageTime}</div>
            <p className="text-xs text-muted-foreground">
              Per student completion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">Good</div>
            <p className="text-xs text-muted-foreground">
              Above class average
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="difficulty" className="space-y-4">
        <TabsList>
          <TabsTrigger value="difficulty">Question Analysis</TabsTrigger>
          <TabsTrigger value="students">Student Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="difficulty">
          <Card>
            <CardHeader>
              <CardTitle>Question Difficulty Analysis</CardTitle>
              <CardDescription>Performance breakdown by question</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.difficultyAnalysis.map((question, index) => (
                  <div key={question.questionId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Q{index + 1}</span>
                        <Badge className={getDifficultyColor(question.difficulty)}>
                          {question.difficulty}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {question.question}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Avg. time: {question.averageTime}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-semibold ${getScoreColor(question.correctRate)}`}>
                        {question.correctRate}%
                      </p>
                      <p className="text-xs text-muted-foreground">correct rate</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle>Individual Student Performance</CardTitle>
              <CardDescription>Detailed scores and completion times</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.studentPerformance.map((student, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <p className="font-medium">{student.studentName}</p>
                      <p className="text-xs text-muted-foreground">
                        Submitted: {student.submittedAt} • Time: {student.timeSpent}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-semibold ${getScoreColor(student.percentage)}`}>
                        {student.score}%
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