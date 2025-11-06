import { useState, useEffect } from "react";
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
  const { data: examData, isLoading } = useExamWithQuestions(examId);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());

  // Initialize timer when exam data loads
  useEffect(() => {
    if (examData) {
      setTimeLeft(examData.duration * 60); // Convert minutes to seconds
    }
  }, [examData]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (!examData) {
    return <ErrorState message="Exam not found" onBack={onExitExam} />;
  }

  if (!examData.questions || examData.questions.length === 0) {
    return <ErrorState message="This exam has no questions" onBack={onExitExam} />;
  }

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const calculateResults = () => {
    let totalScore = 0;
    let correctAnswers = 0;
    const maxScore = examData.total_marks;

    examData.questions.forEach((question: any) => {
      const userAnswer = answers[question.id];
      if (!userAnswer) return;

      if (question.question_type === "mcq") {
        if (userAnswer === question.correct_answer) {
          totalScore += question.points;
          correctAnswers++;
        }
      } else {
        // For descriptive, give partial marks based on answer length
        if (userAnswer.length > 50) {
          totalScore += Math.floor(question.points * 0.75);
          correctAnswers++;
        } else if (userAnswer.length > 20) {
          totalScore += Math.floor(question.points * 0.5);
        }
      }
    });

    return {
      totalScore,
      maxScore,
      correctAnswers,
      incorrectAnswers: examData.questions.length - correctAnswers,
      percentage: Math.round((totalScore / maxScore) * 100),
      answers
    };
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000); // in seconds
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Save submission
      const { data: submission, error: submissionError } = await supabase
        .from('submissions')
        .insert({
          exam_id: examId,
          student_id: user.id,
          answers: answers,
          time_taken: timeSpent
        })
        .select()
        .single();

      if (submissionError) throw submissionError;

      // Calculate results
      const results = calculateResults();
      
      // Save results
      const { error: resultError } = await supabase
        .from('results')
        .insert({
          submission_id: submission.id,
          exam_id: examId,
          student_id: user.id,
          score: results.totalScore,
          total_marks: results.maxScore,
          percentage: results.percentage
        });

      if (resultError) throw resultError;

      toast({
        title: "Exam Submitted Successfully!",
        description: `Score: ${results.totalScore}/${results.maxScore} (${results.percentage}%)`
      });

      onSubmitExam(results);
    } catch (error: any) {
      toast({
        title: "Submission Error",
        description: error.message || "Failed to submit exam",
        variant: "destructive"
      });
      setIsSubmitting(false);
    }
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
              <p className={`text-lg font-mono font-bold ${getTimeColor()}`}>
                <Clock className="inline h-4 w-4 mr-1" />
                {formatTime(timeLeft)}
              </p>
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
            </div>

            <div>
              <h3 className="font-semibold mb-2">Questions</h3>
              <div className="grid grid-cols-5 gap-2">
                {examData.questions.map((_: any, index: number) => {
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