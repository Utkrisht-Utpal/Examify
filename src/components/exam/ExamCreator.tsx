import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Eye, 
  Clock,
  BookOpen,
  FileText,
  Settings,
  CalendarIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useExams } from "@/hooks/useExams";
import { useQuestions } from "@/hooks/useQuestions";
import { supabase } from "@/integrations/supabase/client";

interface ExamCreatorProps {
  onBack: () => void;
}

interface Question {
  id: string;
  type: "mcq" | "descriptive";
  text: string;
  options?: string[];
  correctAnswer?: string;
  points: number;
}

interface ExamDetails {
  title: string;
  subject: string;
  duration: number;
  instructions: string;
  totalPoints: number;
  passingScore: number;
  randomizeQuestions: boolean;
  showResultsImmediately: boolean;
  startTime?: Date;
  endTime?: Date;
  autoClose: boolean;
  isTimed: boolean;
}

export const ExamCreator = ({ onBack }: ExamCreatorProps) => {
  const { toast } = useToast();
  const { createExam, updateExamStatus } = useExams();
  const { createQuestion } = useQuestions();
  
  const [examDetails, setExamDetails] = useState<ExamDetails>({
    title: "",
    subject: "",
    duration: 60,
    instructions: "Read all questions carefully before answering. You have limited time to complete this exam.",
    totalPoints: 0,
    passingScore: 60,
    randomizeQuestions: false,
    showResultsImmediately: false,
    startTime: undefined,
    endTime: undefined,
    autoClose: false,
    isTimed: true
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    id: "",
    type: "mcq",
    text: "",
    options: ["", "", "", ""],
    correctAnswer: "",
    points: 1
  });

  const [activeTab, setActiveTab] = useState("details");

  const addQuestion = () => {
    if (!currentQuestion.text) {
      toast({
        title: "Error",
        description: "Please enter a question text",
        variant: "destructive"
      });
      return;
    }

    if (currentQuestion.type === "mcq") {
      const validOptions = currentQuestion.options?.filter(opt => opt.trim()) || [];
      if (validOptions.length < 2) {
        toast({
          title: "Error", 
          description: "MCQ questions need at least 2 options",
          variant: "destructive"
        });
        return;
      }
      if (!currentQuestion.correctAnswer) {
        toast({
          title: "Error",
          description: "Please select the correct answer",
          variant: "destructive"
        });
        return;
      }
    }

    const newQuestion: Question = {
      ...currentQuestion,
      id: Date.now().toString(),
      options: currentQuestion.type === "mcq" ? currentQuestion.options?.filter(opt => opt.trim()) : undefined
    };

    setQuestions(prev => [...prev, newQuestion]);
    setExamDetails(prev => ({ ...prev, totalPoints: prev.totalPoints + currentQuestion.points }));
    
    // Reset form
    setCurrentQuestion({
      id: "",
      type: "mcq", 
      text: "",
      options: ["", "", "", ""],
      correctAnswer: "",
      points: 1
    });

    toast({
      title: "Question Added",
      description: `Question added successfully. Total: ${questions.length + 1} questions`
    });
  };

  const removeQuestion = (id: string) => {
    const questionToRemove = questions.find(q => q.id === id);
    if (questionToRemove) {
      setQuestions(prev => prev.filter(q => q.id !== id));
      setExamDetails(prev => ({ 
        ...prev, 
        totalPoints: prev.totalPoints - questionToRemove.points 
      }));
      
      toast({
        title: "Question Removed",
        description: "Question has been removed from the exam"
      });
    }
  };

  const saveExam = async (status: 'draft' | 'published' = 'draft') => {
    if (!examDetails.title || !examDetails.subject) {
      toast({
        title: "Error",
        description: "Please fill in exam title and subject",
        variant: "destructive"
      });
      return;
    }

    if (questions.length === 0) {
      toast({
        title: "Error", 
        description: "Please add at least one question",
        variant: "destructive"
      });
      return;
    }

    try {
      toast({
        title: "Saving...",
        description: "Creating exam and questions..."
      });

      // Create the exam
      const examData = {
        title: examDetails.title,
        subject: examDetails.subject,
        description: examDetails.instructions,
        duration: examDetails.duration,
        total_marks: examDetails.totalPoints,
        passing_marks: Math.floor((examDetails.passingScore / 100) * examDetails.totalPoints),
        status: status,
        start_time: examDetails.startTime?.toISOString(),
        end_time: examDetails.endTime?.toISOString(),
        auto_close: examDetails.autoClose,
        is_timed: examDetails.isTimed
      };

      const result = await createExam.mutateAsync(examData);
      
      if (!result) {
        throw new Error('Failed to create exam');
      }

      // Save each question and link to exam
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        // Create the question
        const questionData = {
          question_text: question.text,
          question_type: question.type,
          subject: examDetails.subject,
          options: question.type === 'mcq' && question.options ? question.options : null,
          correct_answer: question.correctAnswer || '',
          points: question.points
        };

        const questionResult = await createQuestion.mutateAsync(questionData);
        
        if (!questionResult) {
          throw new Error(`Failed to create question ${i + 1}`);
        }

        // Link question to exam
        const { error: linkError } = await supabase
          .from('exam_questions')
          .insert({
            exam_id: result.id,
            question_id: questionResult.id,
            order_number: i + 1
          });

        if (linkError) {
          throw new Error(`Failed to link question ${i + 1}: ${linkError.message}`);
        }
      }
      
      toast({
        title: status === 'published' ? "Exam Published Successfully!" : "Exam Saved Successfully!",
        description: status === 'published' 
          ? `"${examDetails.title}" is now live and available to students`
          : `"${examDetails.title}" has been saved as a draft`
      });

      // Go back to dashboard after successful save
      setTimeout(() => onBack(), 1500);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save exam. Please try again.";
      console.error('Exam creation error:', error);
      toast({
        title: "Error Creating Exam",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const publishExam = () => {
    saveExam('published');
  };

  const previewExam = () => {
    if (questions.length === 0) {
      toast({
        title: "No Questions",
        description: "Add some questions before previewing",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Preview Mode",
      description: "Preview functionality would open in a new window"
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create New Exam</h1>
            <p className="text-muted-foreground">Build and customize your examination</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={previewExam}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button variant="outline" onClick={() => saveExam('draft')}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button onClick={publishExam}>
            Publish Exam
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Questions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{questions.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Points</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{examDetails.totalPoints}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{examDetails.duration}min</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Passing Score</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{examDetails.passingScore}%</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Exam Details</TabsTrigger>
          <TabsTrigger value="questions">Add Questions</TabsTrigger>
          <TabsTrigger value="review">Review & Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Set up the fundamental details of your exam</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Exam Title</Label>
                  <Input
                    id="title"
                    value={examDetails.title}
                    onChange={(e) => setExamDetails(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Mathematics Final Exam"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Select 
                    value={examDetails.subject} 
                    onValueChange={(value) => setExamDetails(prev => ({ ...prev, subject: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mathematics">Mathematics</SelectItem>
                      <SelectItem value="physics">Physics</SelectItem>
                      <SelectItem value="chemistry">Chemistry</SelectItem>
                      <SelectItem value="biology">Biology</SelectItem>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="history">History</SelectItem>
                      <SelectItem value="computer-science">Computer Science</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={examDetails.duration}
                    onChange={(e) => setExamDetails(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                    min="1"
                    max="300"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passing">Passing Score (%)</Label>
                  <Input
                    id="passing"
                    type="number"
                    value={examDetails.passingScore}
                    onChange={(e) => setExamDetails(prev => ({ ...prev, passingScore: parseInt(e.target.value) || 60 }))}
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions</Label>
                <Textarea
                  id="instructions"
                  value={examDetails.instructions}
                  onChange={(e) => setExamDetails(prev => ({ ...prev, instructions: e.target.value }))}
                  rows={4}
                  placeholder="Enter exam instructions for students..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exam Scheduling</CardTitle>
              <CardDescription>Set when your exam should be available and when it should close</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !examDetails.startTime && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {examDetails.startTime ? format(examDetails.startTime, "PPP p") : <span>Pick start date & time</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={examDetails.startTime}
                        onSelect={(date) => setExamDetails(prev => ({ ...prev, startTime: date }))}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                      <div className="p-3 border-t">
                        <Label className="text-xs text-muted-foreground">Time (24h format)</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            type="number"
                            min="0"
                            max="23"
                            placeholder="HH"
                            className="w-16"
                            value={examDetails.startTime ? examDetails.startTime.getHours() : ''}
                            onChange={(e) => {
                              const newDate = examDetails.startTime ? new Date(examDetails.startTime) : new Date();
                              newDate.setHours(parseInt(e.target.value) || 0);
                              setExamDetails(prev => ({ ...prev, startTime: newDate }));
                            }}
                          />
                          <span className="self-center">:</span>
                          <Input
                            type="number"
                            min="0"
                            max="59"
                            placeholder="MM"
                            className="w-16"
                            value={examDetails.startTime ? examDetails.startTime.getMinutes() : ''}
                            onChange={(e) => {
                              const newDate = examDetails.startTime ? new Date(examDetails.startTime) : new Date();
                              newDate.setMinutes(parseInt(e.target.value) || 0);
                              setExamDetails(prev => ({ ...prev, startTime: newDate }));
                            }}
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">When students can start taking the exam. Leave empty for immediate availability.</p>
                </div>

                <div className="space-y-2">
                  <Label>End Time (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !examDetails.endTime && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {examDetails.endTime ? format(examDetails.endTime, "PPP p") : <span>Pick end date & time</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={examDetails.endTime}
                        onSelect={(date) => setExamDetails(prev => ({ ...prev, endTime: date }))}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                      <div className="p-3 border-t">
                        <Label className="text-xs text-muted-foreground">Time (24h format)</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            type="number"
                            min="0"
                            max="23"
                            placeholder="HH"
                            className="w-16"
                            value={examDetails.endTime ? examDetails.endTime.getHours() : ''}
                            onChange={(e) => {
                              const newDate = examDetails.endTime ? new Date(examDetails.endTime) : new Date();
                              newDate.setHours(parseInt(e.target.value) || 0);
                              setExamDetails(prev => ({ ...prev, endTime: newDate }));
                            }}
                          />
                          <span className="self-center">:</span>
                          <Input
                            type="number"
                            min="0"
                            max="59"
                            placeholder="MM"
                            className="w-16"
                            value={examDetails.endTime ? examDetails.endTime.getMinutes() : ''}
                            onChange={(e) => {
                              const newDate = examDetails.endTime ? new Date(examDetails.endTime) : new Date();
                              newDate.setMinutes(parseInt(e.target.value) || 0);
                              setExamDetails(prev => ({ ...prev, endTime: newDate }));
                            }}
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">When the exam should stop accepting submissions. Leave empty to keep open indefinitely.</p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-close">Auto-close Exam</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically close exam at end time and prevent new submissions
                    </p>
                  </div>
                  <Switch
                    id="auto-close"
                    checked={examDetails.autoClose}
                    onCheckedChange={(checked) => setExamDetails(prev => ({ ...prev, autoClose: checked }))}
                    disabled={!examDetails.endTime}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="is-timed">Timed Exam</Label>
                    <p className="text-sm text-muted-foreground">
                      Each student has a time limit (duration above) once they start. Uncheck for untimed exams.
                    </p>
                  </div>
                  <Switch
                    id="is-timed"
                    checked={examDetails.isTimed}
                    onCheckedChange={(checked) => setExamDetails(prev => ({ ...prev, isTimed: checked }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Add New Question</CardTitle>
                <CardDescription>Create questions for your exam</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Question Type</Label>
                  <Select 
                    value={currentQuestion.type} 
                    onValueChange={(value: "mcq" | "descriptive") => 
                      setCurrentQuestion(prev => ({ 
                        ...prev, 
                        type: value,
                        options: value === "mcq" ? ["", "", "", ""] : undefined,
                        correctAnswer: value === "mcq" ? "" : undefined
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mcq">Multiple Choice (MCQ)</SelectItem>
                      <SelectItem value="descriptive">Descriptive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Question Text</Label>
                  <Textarea
                    value={currentQuestion.text}
                    onChange={(e) => setCurrentQuestion(prev => ({ ...prev, text: e.target.value }))}
                    placeholder="Enter your question here..."
                    rows={3}
                  />
                </div>

                {currentQuestion.type === "mcq" && (
                  <div className="space-y-3">
                    <Label>Answer Options</Label>
                    {currentQuestion.options?.map((option, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...(currentQuestion.options || [])];
                            newOptions[index] = e.target.value;
                            setCurrentQuestion(prev => ({ ...prev, options: newOptions }));
                          }}
                          placeholder={`Option ${index + 1}`}
                        />
                      </div>
                    ))}
                    
                    <div className="space-y-2">
                      <Label>Correct Answer</Label>
                      <Select
                        value={currentQuestion.correctAnswer}
                        onValueChange={(value) => setCurrentQuestion(prev => ({ ...prev, correctAnswer: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select correct answer" />
                        </SelectTrigger>
                        <SelectContent>
                          {currentQuestion.options?.filter(opt => opt.trim()).map((option, index) => (
                            <SelectItem key={index} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Points</Label>
                  <Input
                    type="number"
                    value={currentQuestion.points}
                    onChange={(e) => setCurrentQuestion(prev => ({ ...prev, points: parseInt(e.target.value) || 1 }))}
                    min="1"
                    max="20"
                  />
                </div>

                <Button onClick={addQuestion} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Questions List ({questions.length})</CardTitle>
                <CardDescription>Review and manage your questions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {questions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No questions added yet. Start by adding your first question.
                    </p>
                  ) : (
                    questions.map((question, index) => (
                      <div key={question.id} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Q{index + 1}</span>
                              <Badge variant="outline">{question.type.toUpperCase()}</Badge>
                              <Badge variant="secondary">{question.points} pts</Badge>
                            </div>
                            <p className="text-sm line-clamp-2">{question.text}</p>
                            {question.type === "mcq" && question.options && (
                              <div className="text-xs text-muted-foreground">
                                Options: {question.options.length} • Correct: {question.correctAnswer}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeQuestion(question.id)}
                            className="ml-2"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="review" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Exam Summary</CardTitle>
              <CardDescription>Review your exam before publishing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="font-semibold">Basic Details</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Title:</span> {examDetails.title || "Not set"}</p>
                    <p><span className="font-medium">Subject:</span> {examDetails.subject || "Not set"}</p>
                    <p><span className="font-medium">Duration:</span> {examDetails.duration} minutes {!examDetails.isTimed && "(Untimed)"}</p>
                    <p><span className="font-medium">Total Points:</span> {examDetails.totalPoints}</p>
                    <p><span className="font-medium">Passing Score:</span> {examDetails.passingScore}%</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h3 className="font-semibold">Question Breakdown</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Total Questions:</span> {questions.length}</p>
                    <p><span className="font-medium">MCQ Questions:</span> {questions.filter(q => q.type === "mcq").length}</p>
                    <p><span className="font-medium">Descriptive:</span> {questions.filter(q => q.type === "descriptive").length}</p>
                  </div>
                </div>
              </div>

              {(examDetails.startTime || examDetails.endTime) && (
                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-3">Scheduling</h3>
                  <div className="space-y-2 text-sm">
                    {examDetails.startTime && (
                      <p><span className="font-medium">Start Time:</span> {format(examDetails.startTime, "PPP 'at' p")}</p>
                    )}
                    {examDetails.endTime && (
                      <p><span className="font-medium">End Time:</span> {format(examDetails.endTime, "PPP 'at' p")}</p>
                    )}
                    {examDetails.endTime && (
                      <p><span className="font-medium">Auto-close:</span> {examDetails.autoClose ? "Enabled" : "Disabled"}</p>
                    )}
                    <p><span className="font-medium">Exam Type:</span> {examDetails.isTimed ? "Timed" : "Untimed"}</p>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-3">Instructions Preview</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm">{examDetails.instructions}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};