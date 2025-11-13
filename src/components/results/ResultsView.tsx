import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Trophy, 
  Clock, 
  CheckCircle, 
  XCircle, 
  BarChart3
} from "lucide-react";
import { useResults } from "@/hooks/useResults";
import { supabase } from "@/integrations/supabase/client";

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
  feedback: string | null;
  questionAnalysis: {
    questionId: string;
    question: string;
    yourAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
  }[];
}

export const ResultsView = ({ user, onBack }: ResultsViewProps) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [detailedResults, setDetailedResults] = useState<StudentResult[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);

  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUserId(authUser.id);
      }
    };
    fetchUserId();
  }, []);

  const { results, isLoading } = useResults(userId || undefined);

  useEffect(() => {
    const fetchDetailedResults = async () => {
      if (!results || results.length === 0) {
        setIsLoadingDetails(false);
        return;
      }

      try {
        const detailedData = await Promise.all(
          results.map(async (result) => {
            // Fetch submission/attempt details with answers
            const { data: attempt } = await supabase
              .from('exam_attempts')
              .select('answers, time_taken')
              .eq('id', result.submission_id)
              .maybeSingle();

            // Also try submissions table as fallback
            const { data: submission } = !attempt ? await supabase
              .from('submissions')
              .select('answers, time_taken')
              .eq('id', result.submission_id)
              .maybeSingle() : { data: null };

            // Fetch exam questions
            const { data: examQuestions } = await supabase
              .from('exam_questions')
              .select(`
                question_id,
                order_number,
                questions (
                  id,
                  question_text,
                  correct_answer,
                  points,
                  question_type
                )
              `)
              .eq('exam_id', result.exam_id)
              .order('order_number');

            const answers = (attempt?.answers || submission?.answers || {}) as Record<string, string>;
            const timeInMinutes = (attempt?.time_taken || submission?.time_taken || 0) as number;
            let correctAnswers = 0;
            let incorrectAnswers = 0;
            
            const questionAnalysis = examQuestions?.map((eq) => {
              const question = eq.questions;
              const userAnswer = answers[question.id] || '';
              const isCorrect = userAnswer.toLowerCase().trim() === question.correct_answer.toLowerCase().trim();
              
              if (isCorrect) correctAnswers++;
              else if (userAnswer) incorrectAnswers++;

              return {
                questionId: question.id,
                question: question.question_text,
                yourAnswer: userAnswer || 'Not answered',
                correctAnswer: question.correct_answer,
                isCorrect
              };
            }) || [];

            const hours = Math.floor(timeInMinutes / 60);
            const minutes = timeInMinutes % 60;
            const timeSpent = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

            return {
              examId: result.exam_id,
              examTitle: result.exams?.title || 'Unknown Exam',
              subject: result.exams?.subject || 'Unknown Subject',
              totalQuestions: examQuestions?.length || 0,
              correctAnswers,
              incorrectAnswers,
              unanswered: (examQuestions?.length || 0) - correctAnswers - incorrectAnswers,
              score: result.score,
              maxScore: result.total_marks,
              percentage: result.percentage,
              timeSpent,
              submittedAt: new Date(result.created_at).toLocaleString(),
              questionAnalysis,
              feedback: (result as any).feedback || null
            };
          })
        );

        setDetailedResults(detailedData);
      } catch (error) {
        console.error('Error fetching detailed results:', error);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchDetailedResults();
  }, [results]);

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return "text-success";
    if (percentage >= 70) return "text-primary";
    if (percentage >= 50) return "text-warning";
    return "text-destructive";
  };

  if (user.role === "student") {
    if (isLoading || isLoadingDetails) {
      return (
        <div className="p-6 space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      );
    }

    if (!detailedResults || detailedResults.length === 0) {
      return (
        <div className="p-6">
          <Button variant="outline" onClick={onBack} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No Results Yet</p>
              <p className="text-sm text-muted-foreground">Complete an exam to see your results here</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    const result = detailedResults[0]; // Show most recent result

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
                {result.percentage}%
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

        {/* Teacher Feedback */}
        {result.feedback && (
          <Card>
            <CardHeader>
              <CardTitle>Teacher's Feedback</CardTitle>
              <CardDescription>Comments from your teacher</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm whitespace-pre-wrap">{result.feedback}</p>
              </div>
            </CardContent>
          </Card>
        )}

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

  // Teacher Analytics View - Coming Soon
  return (
    <div className="p-6 space-y-6">
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

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Teacher Analytics</p>
          <p className="text-sm text-muted-foreground">Detailed analytics for exam results will be available soon</p>
        </CardContent>
      </Card>
    </div>
  );
};
