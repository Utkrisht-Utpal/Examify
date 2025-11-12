import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Clock, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { useExamWithQuestions } from "@/hooks/useExams";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LoadingState, ErrorState } from "./ExamStates";

interface Question {
  id: string;
  type: "mcq" | "descriptive";
  text: string;
  options?: string[];
  answer?: string;
}

interface ExamInterfaceProps {
  examId: string;
  onSubmitExam: (results: {
    totalScore: number;
    maxScore: number;
    correctAnswers: number;
    incorrectAnswers: number;
    percentage: number;
    answers: Record<string, string>;
  }) => void;
  onExitExam: () => void;
}

export const ExamInterface = ({ examId, onSubmitExam, onExitExam }: ExamInterfaceProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  console.log('ExamInterface mounted with examId:', examId);
  
  const { data: examData, isLoading, error: examError } = useExamWithQuestions(examId);
  
  console.log('ExamInterface state:', { examData, isLoading, examError });
  
  type ScorableQuestion = {
    id: string;
    question_type: 'mcq' | 'descriptive';
    correct_answer?: string | null;
    points: number;
  };

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerInitialized, setTimerInitialized] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());
  const [hasExistingSubmission, setHasExistingSubmission] = useState(false);

  // Check for existing submission when component mounts
  useEffect(() => {
    const checkExistingSubmission = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: existingSubmission } = await supabase
          .from('submissions')
          .select('id')
          .eq('exam_id', examId)
          .eq('student_id', user.id)
          .maybeSingle();

        if (existingSubmission) {
          setHasExistingSubmission(true);
        }
      } catch (error) {
        console.error('Error checking for existing submission:', error);
      }
    };

    checkExistingSubmission();
  }, [examId]);

  // Memoized submit handler
  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    
    console.log('=== EXAM SUBMISSION START ===');
    console.log('Current answers state:', answers);
    console.log('Number of answers:', Object.keys(answers).length);
    console.log('Answers keys:', Object.keys(answers));
    
    // Validate that we have at least one answer
    if (Object.keys(answers).length === 0) {
      toast({
        title: "No Answers Provided",
        description: "Please answer at least one question before submitting.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // For students, correct answers may be sanitized away via RLS.
      // Avoid auto-scoring if correct_answer is not available.
      const maxScore = examData?.total_marks || 0;
      let totalScore = 0;
      let correctAnswers = 0;
      const anyMissingCorrect = examData?.questions?.some((q: { correct_answer?: string | null }) => q.correct_answer == null);

      if (!anyMissingCorrect) {
        examData?.questions?.forEach((question: ScorableQuestion) => {
          const userAnswer = answers[question.id];
          if (!userAnswer) return;
          if (question.question_type === "mcq") {
            if (userAnswer === question.correct_answer) {
              totalScore += question.points;
              correctAnswers++;
            }
          } else {
            // Optional heuristic for descriptive, but teacher will finalize grading anyway
            // Keep at zero to avoid misleading results
          }
        });
      }

      const results = {
        totalScore,
        maxScore,
        correctAnswers,
        incorrectAnswers: anyMissingCorrect ? 0 : (examData?.questions?.length || 0) - correctAnswers,
        percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
        answers
      };

      // Save submission
      console.log('Saving submission with answers:', answers);
      console.log('Answers JSON:', JSON.stringify(answers));
      
      const { data: submission, error: submissionError } = await supabase
        .from('submissions')
        .insert({
          exam_id: examId,
          student_id: user.id,
          answers: answers,
          time_taken: Math.floor(timeSpent / 60) // Convert seconds to minutes
        })
        .select()
        .single();

      if (submissionError) {
        console.error('Submission error:', submissionError);
        throw submissionError;
      }
      
      console.log('Submission created successfully:', submission);
      console.log('Submission answers field:', submission.answers);
      
      // Do NOT create a result here. Results are created/updated only by teachers during grading.
      // Invalidate queries to refresh teacher and student views
      console.log('Invalidating queries for userId:', user.id);
      await queryClient.invalidateQueries({ queryKey: ['submissions', examId] });
      await queryClient.invalidateQueries({ queryKey: ['submittedExams', user.id] });
      await queryClient.invalidateQueries({ queryKey: ['pending-submissions'] });
      
      // Force refetch to ensure fresh data where appropriate
      await queryClient.refetchQueries({ queryKey: ['submittedExams', user.id] });
      
      console.log('=== EXAM SUBMISSION COMPLETE ===');

      toast({
        title: "Exam submitted!",
        description: "Your answers were saved. A teacher will review and grade your submission."
      });

      // Pass back the local calculation if the caller wants to show a provisional summary,
      // but it is NOT persisted and not the final grade.
      onSubmitExam(results);
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to submit exam";
      toast({
        title: "Submission Error",
        description: errorMessage,
        variant: "destructive"
      });
      setIsSubmitting(false);
    }
  }, [examData, answers, examId, startTime, isSubmitting, toast, onSubmitExam, queryClient]);

  // Initialize timer when exam data loads
  useEffect(() => {
    if (examData && examData.is_timed) {
      console.log('Setting timer for', examData.duration, 'minutes');
      setTimeLeft(examData.duration * 60);
      setTimerInitialized(true);
    }
  }, [examData]);

  // Timer effect - only for timed exams
  useEffect(() => {
    if (!examData?.is_timed || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examData?.is_timed, timeLeft]);

  // Auto-submit effect when time runs out
  useEffect(() => {
    if (timeLeft === 0 && examData?.is_timed && timerInitialized && !isSubmitting) {
      console.log('Time expired, auto-submitting exam');
      setTimeout(() => handleSubmit(), 0);
    }
  }, [timeLeft, examData?.is_timed, timerInitialized, isSubmitting, handleSubmit]);

  // Show loading state
  if (isLoading) {
    console.log('Showing loading state');
    return <LoadingState />;
  }

  // Show error if query failed
  if (examError) {
    console.error('Exam loading error:', examError);
    return (
      <ErrorState 
        message={`Failed to load exam: ${examError instanceof Error ? examError.message : 'Unknown error'}`} 
        onBack={onExitExam} 
      />
    );
  }

  // Check if exam data exists
  if (!examData) {
    console.error('No exam data received');
    return <ErrorState message="Exam not found. Please contact your teacher." onBack={onExitExam} />;
  }

  // Check if exam has questions
  if (!examData.questions || examData.questions.length === 0) {
    console.error('Exam has no questions:', examData);
    return <ErrorState message="This exam has no questions yet. Please contact your teacher." onBack={onExitExam} />;
  }

  // Check if student has already submitted this exam
  if (hasExistingSubmission) {
    return (
      <ErrorState 
        message="You have already submitted this exam. You cannot take it again." 
        onBack={onExitExam} 
      />
    );
  }
  
  console.log('Rendering exam interface with', examData.questions.length, 'questions');

  // Check if exam is scheduled and not yet available
  if (examData.start_time && new Date(examData.start_time) > new Date()) {
    return (
      <ErrorState 
        message={`This exam will be available on ${format(new Date(examData.start_time), "PPP 'at' p")}`} 
        onBack={onExitExam} 
      />
    );
  }

  // Check if exam has ended
  if (examData.end_time && examData.auto_close && new Date(examData.end_time) < new Date()) {
    return (
      <ErrorState 
        message="This exam has ended and is no longer accepting submissions" 
        onBack={onExitExam} 
      />
    );
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    console.log('Answer changed for question:', questionId, 'Value:', answer);
    setAnswers(prev => {
      const updated = {
        ...prev,
        [questionId]: answer
      };
      console.log('Updated answers state:', updated);
      console.log('Total answers:', Object.keys(updated).length);
      return updated;
    });
  };

  const getTimeColor = () => {
    if (timeLeft < 300) return "text-destructive"; // Less than 5 minutes
    if (timeLeft < 900) return "text-warning"; // Less than 15 minutes
    return "text-foreground";
  };

  const getQuestionStatus = (index: number) => {
    const questionId = examData.questions[index].id;
    if (answers[questionId]) return "answered";
    if (index === currentQuestion) return "current";
    return "unanswered";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "answered":
        return "bg-success text-success-foreground";
      case "current":
        return "bg-primary text-primary-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / examData.questions.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold">{examData.title}</h1>
            <p className="text-sm text-muted-foreground">
              Question {currentQuestion + 1} of {examData.questions.length}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Time Remaining</p>
              {examData.is_timed ? (
                <p className={`text-lg font-mono font-bold ${getTimeColor()}`}>
                  <Clock className="inline h-4 w-4 mr-1" />
                  {formatTime(timeLeft)}
                </p>
              ) : (
                <p className="text-lg font-bold text-muted-foreground">
                  <Clock className="inline h-4 w-4 mr-1" />
                  Untimed
                </p>
              )}
            </div>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={isSubmitting}>
                  Submit Exam
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Submit Examination</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to submit your exam? You have answered {answeredCount} out of {examData.questions.length} questions.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Continue Exam</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSubmit}>Submit Now</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Question Navigation Sidebar */}
        <div className="w-64 border-r bg-card p-4 min-h-[calc(100vh-4rem)]">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Progress</h3>
              <Progress value={progress} className="mb-2" />
              <p className="text-sm text-muted-foreground">
                {answeredCount}/{examData.questions.length} completed
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Debug: {Object.keys(answers).length} answers saved
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Questions</h3>
              <div className="grid grid-cols-5 gap-2">
                {examData.questions.map((_, index: number) => {
                  const status = getQuestionStatus(index);
                  return (
                    <button
                      key={index}
                      onClick={() => setCurrentQuestion(index)}
                      className={`h-8 w-8 rounded text-sm font-medium transition-colors ${getStatusColor(status)}`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-success"></div>
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-primary"></div>
                  <span>Current</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-muted"></div>
                  <span>Unanswered</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Question {currentQuestion + 1}</CardTitle>
                <Badge variant="outline">
                  {examData.questions[currentQuestion].question_type.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-lg">
                {examData.questions[currentQuestion].question_text}
              </div>

              {examData.questions[currentQuestion]?.question_type === "mcq" && 
               examData.questions[currentQuestion]?.options && 
               Array.isArray(examData.questions[currentQuestion].options) && (
                <RadioGroup
                  value={answers[examData.questions[currentQuestion].id] || ""}
                  onValueChange={(value) => handleAnswerChange(examData.questions[currentQuestion].id, value)}
                >
                  {examData.questions[currentQuestion].options.map((option: string, index: number) => (
                    <div key={index} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={`option-${index}`} />
                      <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {examData.questions[currentQuestion].question_type === "descriptive" && (
                <Textarea
                  placeholder="Type your answer here..."
                  className="min-h-32"
                  value={answers[examData.questions[currentQuestion].id] || ""}
                  onChange={(e) => handleAnswerChange(examData.questions[currentQuestion].id, e.target.value)}
                />
              )}

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                  disabled={currentQuestion === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                <Button
                  onClick={() => setCurrentQuestion(Math.min(examData.questions.length - 1, currentQuestion + 1))}
                  disabled={currentQuestion === examData.questions.length - 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};