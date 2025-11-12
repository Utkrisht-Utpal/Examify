import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  Clock,
  User,
  Calendar,
  FileText,
  Save
} from "lucide-react";
import { useGrading } from "@/hooks/useGrading";
import { Skeleton } from "@/components/ui/skeleton";

interface GradingInterfaceProps {
  submissionId: string;
  onBack: () => void;
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options?: string[];
  correct_answer: string;
  points: number;
}

interface SubmissionData {
  submission: {
    id: string;
    exam_id: string;
    student_id: string;
    submitted_at: string;
    time_taken: number;
    answers: Record<string, string>;
    exams: { id: string; title: string; total_marks: number };
    profiles: { full_name: string };
  };
  questions: Array<{ questions: Question }>;
}

export const GradingInterface = ({ submissionId, onBack }: GradingInterfaceProps) => {
  const { fetchSubmissionDetails, gradeSubmission } = useGrading();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submissionData, setSubmissionData] = useState<SubmissionData | null>(null);
  // Allow empty string during typing to prevent auto-reset to 0
  const [questionGrades, setQuestionGrades] = useState<Record<string, number | ''>>({});
  const [feedback, setFeedback] = useState("");
  const [totalScore, setTotalScore] = useState(0);
  
  console.log('GradingInterface - submissionId:', submissionId);

  useEffect(() => {
    const loadSubmission = async () => {
      try {
        console.log('Loading submission details for ID:', submissionId);
        setError(null);
        const data = await fetchSubmissionDetails(submissionId);
        console.log('Submission data loaded:', data);
        setSubmissionData(data);
        
        // Initialize grades based on correct/incorrect answers
        const initialGrades: Record<string, number | ''> = {};
        let autoScore = 0;
        
        if (data?.questions && Array.isArray(data.questions)) {
          data.questions.forEach((eq) => {
            const question = eq.questions as Question;
            if (!question) return;
            const userAnswer = data.submission.answers[question.id] || '';
            const isCorrect = userAnswer.toLowerCase().trim() === question.correct_answer?.toLowerCase().trim();
            const points = isCorrect ? question.points : 0;
            initialGrades[question.id] = points;
            autoScore += points;
          });
        }
        
        console.log('Initial grades:', initialGrades);
        console.log('Auto score:', autoScore);
        setQuestionGrades(initialGrades);
        setTotalScore(autoScore);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load submission';
        console.error('Error loading submission:', err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadSubmission();
  }, [submissionId, fetchSubmissionDetails]);

  const handleGradeChange = (questionId: string, raw: string, maxPoints: number) => {
    // Allow empty input while typing; treat as 0 for totals
    if (raw === '') {
      const merged = { ...questionGrades, [questionId]: '' as const };
      const newTotal = Object.values(merged).reduce((sum, pts) => sum + (typeof pts === 'number' ? pts : 0), 0);
      setQuestionGrades(merged);
      setTotalScore(newTotal);
      return;
    }

    const parsed = Number(raw);
    const safe = Number.isFinite(parsed) ? parsed : 0;
    const validPoints = Math.max(0, Math.min(safe, maxPoints));

    const merged = { ...questionGrades, [questionId]: validPoints };
    const newTotal = Object.values(merged).reduce((sum, pts) => sum + (typeof pts === 'number' ? pts : 0), 0);
    setQuestionGrades(merged);
    setTotalScore(newTotal);
  };

  const handleSubmitGrade = async () => {
    if (!submissionData) return;

    await gradeSubmission.mutateAsync({
      submissionId: submissionData.submission.id,
      examId: submissionData.submission.exam_id,
      studentId: submissionData.submission.student_id,
      score: totalScore,
      totalMarks: submissionData.submission.exams.total_marks,
      feedback
    });

    onBack();
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!submissionData) {
    return (
      <div className="p-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card className="mt-4">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Submission not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { submission, questions } = submissionData;
  const percentage = Math.round((totalScore / submission.exams.total_marks) * 100);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Grade Submission</h1>
            <p className="text-muted-foreground">Review and assign marks</p>
          </div>
        </div>
        <Button onClick={handleSubmitGrade} disabled={gradeSubmission.isPending}>
          <Save className="h-4 w-4 mr-2" />
          Save Grade
        </Button>
      </div>

      {/* Student Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Submission Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Student</p>
                <p className="text-sm text-muted-foreground">{submission.profiles.full_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Exam</p>
                <p className="text-sm text-muted-foreground">{submission.exams.title}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Submitted</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(submission.submitted_at).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Time Taken</p>
                <p className="text-sm text-muted-foreground">{submission.time_taken || 0} minutes</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Score</p>
              <p className="text-3xl font-bold">
                {totalScore} / {submission.exams.total_marks}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Percentage</p>
              <p className="text-3xl font-bold text-primary">{percentage}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions Grading */}
      <Card>
        <CardHeader>
          <CardTitle>Question-wise Grading</CardTitle>
          <CardDescription>Review answers and assign marks for each question</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {questions.map((eq, index: number) => {
              const question = eq.questions;
              const userAnswer = submission.answers[question.id] || '';
              const isCorrect = userAnswer.toLowerCase().trim() === question.correct_answer.toLowerCase().trim();
              
              return (
                <div key={question.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold">Question {index + 1}</span>
                        <Badge variant={isCorrect ? "default" : "secondary"}>
                          {question.question_type}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Max: {question.points} points
                        </span>
                      </div>
                      <p className="text-sm mb-3">{question.question_text}</p>
                      
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm font-medium">Student's Answer:</p>
                          <div className={`p-3 rounded-md border ${
                            isCorrect ? 'bg-success/10 border-success' : 'bg-muted'
                          }`}>
                            <p className="text-sm">{userAnswer || 'No answer provided'}</p>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium">Correct Answer:</p>
                          <div className="p-3 rounded-md bg-success/10 border border-success">
                            <p className="text-sm">{question.correct_answer}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label htmlFor={`points-${question.id}`}>Assign Points</Label>
                      <Input
                        id={`points-${question.id}`}
                        type="number"
                        min={0}
                        max={question.points}
                        value={questionGrades[question.id] === '' || questionGrades[question.id] === undefined ? '' : (questionGrades[question.id] as number)}
                        onChange={(e) => handleGradeChange(
                          question.id,
                          e.target.value,
                          question.points
                        )}
                        className="w-32"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {isCorrect ? (
                        <Badge className="bg-success text-success-foreground">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Auto-graded: Correct
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Needs review
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Feedback Section */}
      <Card>
        <CardHeader>
          <CardTitle>Feedback (Optional)</CardTitle>
          <CardDescription>Provide detailed feedback to the student</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Enter your feedback here..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={6}
          />
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button onClick={handleSubmitGrade} disabled={gradeSubmission.isPending} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {gradeSubmission.isPending ? 'Saving...' : 'Save Grade and Submit'}
        </Button>
      </div>
    </div>
  );
};
