import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, BookOpen, Users, BarChart3, FileText, Calendar, Eye, Clock } from "lucide-react";
import { useExams } from "@/hooks/useExams";
import { useSubmissions } from "@/hooks/useSubmissions";
import { useGrading } from "@/hooks/useGrading";
import { supabase } from "@/integrations/supabase/client";

interface TeacherDashboardProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
  onCreateExam: () => void;
  onViewResults: () => void;
  onViewExam: (examId: string) => void;
  onGradeSubmission: (submissionId: string) => void;
}

export const TeacherDashboard = ({ user, onCreateExam, onViewResults, onViewExam, onGradeSubmission }: TeacherDashboardProps) => {
  const { exams, isLoading: examsLoading, updateExamStatus } = useExams();
  const { submissions } = useSubmissions();
  const { pendingSubmissions, isLoadingSubmissions } = useGrading();
  
  // Get current user ID from Supabase
  const [userId, setUserId] = React.useState<string | null>(null);
  const [studentCount, setStudentCount] = React.useState<number>(0);
  
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);

  // Fetch actual student count from user_roles table with real-time updates
  React.useEffect(() => {
    const fetchStudentCount = async () => {
      const { count, error } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student');
      
      if (!error && count !== null) {
        setStudentCount(count);
      }
    };

    // Initial fetch
    fetchStudentCount();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('user_roles_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
          filter: 'role=eq.student'
        },
        () => {
          // Refetch count when changes occur
          fetchStudentCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const teacherExams = exams?.filter(exam => exam.created_by === userId) || [];
  
  // Group submissions by exam for quick counts
  const submissionsByExam: Record<string, number> = (submissions || []).reduce((acc: Record<string, number>, s: any) => {
    const key = s.exam_id;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  
  const recentActivity = submissions?.slice(0, 4).map(sub => ({
    type: "submission",
    student: sub.profiles?.full_name || 'Unknown',
    exam: sub.exams?.title || 'Unknown',
    time: new Date(sub.submitted_at).toLocaleString()
  })) || [];

  const handlePublishExam = (examId: string) => {
    updateExamStatus.mutate({ examId, status: 'published' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success text-success-foreground";
      case "completed":
        return "bg-primary text-primary-foreground";
      case "draft":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "submission":
        return <FileText className="h-4 w-4" />;
      case "exam_created":
        return <PlusCircle className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
          <p className="text-muted-foreground">Manage your exams and track student progress</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={onCreateExam}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Create Exam
          </Button>
          <Button variant="outline" onClick={onViewResults}>
            <BarChart3 className="h-4 w-4 mr-2" />
            View Analytics
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teacherExams.length}</div>
            <p className="text-xs text-muted-foreground">
              {teacherExams.filter(e => e.status === "published").length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{studentCount}</div>
            <p className="text-xs text-muted-foreground">
              Enrolled students
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">82%</div>
            <p className="text-xs text-muted-foreground">
              +2% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Submissions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{submissions?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total submissions
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="exams" className="space-y-4">
        <TabsList>
          <TabsTrigger value="exams">My Exams</TabsTrigger>
          <TabsTrigger value="grading">
            Pending Grading
            {pendingSubmissions && pendingSubmissions.length > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingSubmissions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="exams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exam Management</CardTitle>
              <CardDescription>Create, edit, and monitor your exams</CardDescription>
            </CardHeader>
            <CardContent>
              {examsLoading ? (
                <p className="text-center text-muted-foreground py-4">Loading exams...</p>
              ) : teacherExams.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No exams created yet</p>
              ) : (
                  <div className="space-y-4">
                  {teacherExams.map((exam) => (
                    <div key={exam.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{exam.title}</h3>
                          <Badge className={getStatusColor(exam.status)}>
                            {exam.status}
                          </Badge>
                          {!exam.is_timed && (
                            <Badge variant="outline">Untimed</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {exam.subject}
                          </div>
                          <div className="flex items-center gap-1">
                            <BarChart3 className="h-3 w-3" />
                            {exam.total_marks} marks
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Created {new Date(exam.created_at).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {submissionsByExam[exam.id] || 0} submissions
                          </div>
                        </div>
                        {(exam.start_time || exam.end_time) && (
                          <div className="text-xs text-muted-foreground space-y-1">
                            {exam.start_time && (
                              <p>📅 Starts: {new Date(exam.start_time).toLocaleString()}</p>
                            )}
                            {exam.end_time && (
                              <p>⏰ {exam.auto_close ? 'Closes' : 'Ends'}: {new Date(exam.end_time).toLocaleString()}</p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => onViewExam(exam.id)}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button variant="outline" size="sm" onClick={onViewResults}>
                          Results
                        </Button>
                        {exam.status === "draft" && (
                          <Button 
                            size="sm"
                            onClick={() => handlePublishExam(exam.id)}
                            disabled={updateExamStatus.isPending}
                          >
                            {updateExamStatus.isPending ? 'Publishing...' : 'Publish'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grading" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Grading</CardTitle>
              <CardDescription>Review and grade student submissions</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSubmissions ? (
                <p className="text-center text-muted-foreground py-4">Loading submissions...</p>
              ) : !pendingSubmissions || pendingSubmissions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No submissions pending grading</p>
              ) : (
                <div className="space-y-4">
                  {pendingSubmissions.map((submission) => {
                    const hasResult = submission.results && submission.results.length > 0;
                    const isGraded = hasResult && submission.results[0].graded_at;
                    
                    return (
                      <div key={submission.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{submission.profiles.full_name}</h3>
                            {isGraded ? (
                              <Badge variant="outline" className="bg-success/10 text-success">
                                Graded
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                Pending
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <BookOpen className="h-3 w-3" />
                              {submission.exams.title}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(submission.submitted_at).toLocaleString()}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {submission.time_taken || 0} min
                            </div>
                          </div>
                          {isGraded && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Score: </span>
                              <span className="font-medium">
                                {submission.results[0].score}/{submission.results[0].total_marks}
                              </span>
                              <span className="text-muted-foreground ml-2">
                                ({submission.results[0].percentage}%)
                              </span>
                            </div>
                          )}
                        </div>
                        <Button 
                          variant={isGraded ? "outline" : "default"} 
                          size="sm"
                          onClick={() => onGradeSubmission(submission.id)}
                        >
                          {isGraded ? 'Review' : 'Grade Now'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest student submissions and exam updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1">
                      {activity.type === "submission" ? (
                        <p className="text-sm">
                          <span className="font-medium">{activity.student}</span> submitted {activity.exam}
                        </p>
                      ) : (
                        <p className="text-sm">
                          Created exam: <span className="font-medium">{activity.exam}</span>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
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