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
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(5400); // 90 minutes in seconds
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sample exam data
  const exam = {
    id: examId,
    title: "Mathematics Final Exam",
    duration: 90,
    questions: [
      {
        id: "1",
        type: "mcq" as const,
        text: "What is the derivative of x² + 3x + 2?",
        options: ["2x + 3", "x² + 3", "2x + 2", "3x + 2"]
      },
      {
        id: "2", 
        type: "mcq" as const,
        text: "If f(x) = sin(x), what is f'(x)?",
        options: ["cos(x)", "-cos(x)", "sin(x)", "-sin(x)"]
      },
      {
        id: "3",
        type: "descriptive" as const,
        text: "Explain the fundamental theorem of calculus and provide an example of its application."
      },
      {
        id: "4",
        type: "mcq" as const,
        text: "What is the integral of 2x dx?",
        options: ["x²", "x² + C", "2x²", "2x² + C"]
      },
      {
        id: "5",
        type: "descriptive" as const,
        text: "Solve the differential equation dy/dx = 2x and explain your solution method."
      }
    ]
  };

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
    const maxScore = exam.questions.length * 20; // Assuming 20 points per question

    exam.questions.forEach((question) => {
      const userAnswer = answers[question.id];
      if (!userAnswer) return;

      if (question.type === "mcq") {
        if (userAnswer === question.options?.[0]) { // First option is correct for demo
          totalScore += 20;
          correctAnswers++;
        }
      } else {
        // For descriptive, give partial marks based on answer length
        if (userAnswer.length > 50) {
          totalScore += 15; // Partial marks
          correctAnswers++;
        } else if (userAnswer.length > 20) {
          totalScore += 10;
        }
      }
    });

    return {
      totalScore,
      maxScore,
      correctAnswers,
      incorrectAnswers: exam.questions.length - correctAnswers,
      percentage: Math.round((totalScore / maxScore) * 100),
      answers
    };
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    const results = calculateResults();
    onSubmitExam(results);
  };

  const getTimeColor = () => {
    if (timeLeft < 300) return "text-destructive"; // Less than 5 minutes
    if (timeLeft < 900) return "text-warning"; // Less than 15 minutes
    return "text-foreground";
  };

  const getQuestionStatus = (index: number) => {
    const questionId = exam.questions[index].id;
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
  const progress = (answeredCount / exam.questions.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold">{exam.title}</h1>
            <p className="text-sm text-muted-foreground">
              Question {currentQuestion + 1} of {exam.questions.length}
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
                    Are you sure you want to submit your exam? You have answered {answeredCount} out of {exam.questions.length} questions.
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
                {answeredCount}/{exam.questions.length} completed
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Questions</h3>
              <div className="grid grid-cols-5 gap-2">
                {exam.questions.map((_, index) => {
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
                  {exam.questions[currentQuestion].type.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-lg">
                {exam.questions[currentQuestion].text}
              </div>

              {exam.questions[currentQuestion].type === "mcq" && exam.questions[currentQuestion].options && (
                <RadioGroup
                  value={answers[exam.questions[currentQuestion].id] || ""}
                  onValueChange={(value) => handleAnswerChange(exam.questions[currentQuestion].id, value)}
                >
                  {exam.questions[currentQuestion].options!.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={`option-${index}`} />
                      <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {exam.questions[currentQuestion].type === "descriptive" && (
                <Textarea
                  placeholder="Type your answer here..."
                  className="min-h-32"
                  value={answers[exam.questions[currentQuestion].id] || ""}
                  onChange={(e) => handleAnswerChange(exam.questions[currentQuestion].id, e.target.value)}
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
                  onClick={() => setCurrentQuestion(Math.min(exam.questions.length - 1, currentQuestion + 1))}
                  disabled={currentQuestion === exam.questions.length - 1}
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