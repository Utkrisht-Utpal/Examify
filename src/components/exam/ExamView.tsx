import React from "react";
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
import { useExamWithQuestions } from "@/hooks/useExams";
import { useSubmissions } from "@/hooks/useSubmissions";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "./ExamStates";

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
  const { data: examData, isLoading } = useExamWithQuestions(examId);
  const { submissions } = useSubmissions();
  const [averageScore, setAverageScore] = React.useState(0);
  const [submissionResults, setSubmissionResults] = React.useState<Record<string, any>>({});

  if (isLoading) {
    return <LoadingState />;
  }

  if (!examData) {
    return (
      <div className="p-6">
        <Button onClick={onBack}>← Back</Button>
        <p className="text-center text-muted-foreground py-8">Exam not found</p>
      </div>
    );
  }

  const examSubmissions = submissions?.filter(s => s.exam_id === examId) || [];
  const studentsCompleted = examSubmissions.length;
  const studentsEnrolled = studentsCompleted; // This should come from enrollment data
  
  // Fetch average score and submission results
  React.useEffect(() => {
    const fetchData = async () => {
      // Fetch average score
      const { data: results } = await supabase
        .from('results')
        .select('percentage, submission_id, score')
        .eq('exam_id', examId);
      
      if (results && results.length > 0) {
        const avg = results.reduce((acc, r) => acc + r.percentage, 0) / results.length;
        setAverageScore(avg);
        
        // Create a map of submission_id to result
        const resultsMap: Record<string, any> = {};
        results.forEach(r => {
          resultsMap[r.submission_id] = r;
        });
        setSubmissionResults(resultsMap);
      }
    };
    fetchData();
  }, [examId]);

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

  const completionRate = studentsEnrolled > 0 ? (studentsCompleted / studentsEnrolled) * 100 : 0;

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
            <p className="text-muted-foreground">{examData.subject} • Created on {new Date(examData.created_at).toLocaleDateString()}</p>
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
            <div className="text-2xl font-bold">{studentsEnrolled}</div>
            <Progress value={completionRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {studentsCompleted} completed ({completionRate.toFixed(0)}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{averageScore.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Passing score: {Math.round((examData.passing_marks / examData.total_marks) * 100)}%
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
              {examData.questions?.length || 0} questions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Points</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{examData.total_marks}</div>
            <p className="text-xs text-muted-foreground">
              Max possible score
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Exam Schedule */}
      {(examData.start_time || examData.end_time) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Exam Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {examData.start_time && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Start Time</p>
                  <p className="text-lg font-semibold">{new Date(examData.start_time).toLocaleString()}</p>
                </div>
              )}
              {examData.end_time && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">End Time</p>
                  <p className="text-lg font-semibold">{new Date(examData.end_time).toLocaleString()}</p>
                </div>
              )}
              {examData.end_time && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Auto-close</p>
                  <p className="text-lg font-semibold">
                    <Badge variant={examData.auto_close ? "default" : "secondary"}>
                      {examData.auto_close ? "Enabled" : "Disabled"}
                    </Badge>
                  </p>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground">Exam Type</p>
              <p className="text-base">
                <Badge variant={examData.is_timed ? "default" : "outline"}>
                  {examData.is_timed ? "Timed Exam" : "Untimed Exam"}
                </Badge>
                {examData.is_timed && (
                  <span className="ml-2 text-muted-foreground">
                    ({examData.duration} minutes per student)
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Exam Details</TabsTrigger>
          <TabsTrigger value="questions">Questions ({examData.questions?.length || 0})</TabsTrigger>
          <TabsTrigger value="submissions">Submissions ({studentsCompleted})</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Instructions</CardTitle>
              <CardDescription>Student guidelines for taking this exam</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-lg">
                <p className="whitespace-pre-line">{examData.description || 'No instructions provided'}</p>
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
                {(examData.questions || []).filter((q: any) => q !== null).map((question: any, index: number) => (
                  <div key={question.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Question {index + 1}</span>
                        <Badge variant="outline">{question.question_type?.toUpperCase()}</Badge>
                        <Badge variant="secondary">{question.points} points</Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <p className="font-medium">{question.question_text}</p>
                      
                      {question.question_type === "mcq" && question.options && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Options:</p>
                          <div className="grid gap-2">
                            {question.options.map((option: string, optIndex: number) => (
                              <div 
                                key={optIndex} 
                                className={`text-sm p-2 rounded border ${
                                  option === question.correct_answer 
                                    ? 'bg-success/20 border-success text-success-foreground' 
                                    : 'bg-muted'
                                }`}
                              >
                                {String.fromCharCode(65 + optIndex)}. {option}
                                {option === question.correct_answer && (
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
                {examSubmissions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No submissions yet</p>
                ) : (
                  examSubmissions.map((submission: any, index: number) => {
                    const result = submissionResults[submission.id];
                    return (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{submission.profiles?.full_name || 'Unknown Student'}</p>
                            <Badge variant="default">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              completed
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Submitted: {new Date(submission.submitted_at).toLocaleString()} • 
                            Time: {submission.time_taken ? `${Math.floor(submission.time_taken / 60)}m` : 'N/A'}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold">
                            {result?.score || 0}/{examData.total_marks}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {result?.percentage || 0}%
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};