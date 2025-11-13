import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, BookOpen, Users, BarChart3, FileText, Calendar, Eye, Clock, Trash2 } from "lucide-react";
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
  const { exams, isLoading: examsLoading, updateExamStatus, deleteExam } = useExams();
  const { submissions } = useSubmissions();
  const { pendingSubmissions, isLoadingSubmissions, allSubmissions, isLoadingAllSubmissions } = useGrading();
  
  // Get current user ID from Supabase
  const [userId, setUserId] = React.useState<string | null>(null);
  const [studentCount, setStudentCount] = React.useState<number>(0);
  const [avgPercentage, setAvgPercentage] = React.useState<number>(0);
  const [avgCount, setAvgCount] = React.useState<number>(0);
  
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);

  // Fetch student count from user_roles with safe fallbacks; keep real-time updates
  React.useEffect(() => {
    let cancelled = false;

    const fetchFromUserRoles = async () => {
      // Avoid head:true because some setups drop count in HEAD responses under RLS
      const { count, error } = await supabase
        .from('user_roles')
        .select('user_id', { count: 'exact' }) // no head; allow PostgREST to include count reliably
        .eq('role', 'student')
        .range(0, 0); // fetch minimal payload while still getting count
      if (cancelled) return { count: null, error };
      return { count, error };
    };

    const fetchFromRPC = async (): Promise<number | null> => {
      // Prefer a SECURITY DEFINER RPC that bypasses RLS reliably
      const { data, error } = await supabase.rpc('get_total_students');
      if (cancelled) return null;
      if (!error && typeof data === 'number') return data;
      return null;
    };

    const fetchFallback = async (): Promise<number> => {
      // Try distinct students from exam_attempts first
      const { data: attempts, error: attemptsErr } = await supabase
        .from('exam_attempts')
        .select('student_id');
      if (!attemptsErr && attempts) {
        const uniq = new Set((attempts || []).map((r: any) => r.student_id).filter(Boolean));
        if (uniq.size > 0) return uniq.size;
      }

      // Fallback to submissions if attempts not available
      const { data: subs, error: subsErr } = await supabase
        .from('submissions')
        .select('student_id');
      if (!subsErr && subs) {
        const uniq = new Set((subs || []).map((r: any) => r.student_id).filter(Boolean));
        return uniq.size;
      }

      return 0;
    };

    const fetchStudentCount = async () => {
      // Compute RPC, table count and fallback, then pick the max as the final value
      const [rpcCount, primary, fallbackCount] = await Promise.all([
        fetchFromRPC(),
        fetchFromUserRoles(),
        fetchFallback(),
      ]);
      const primaryCount = !primary.error && typeof primary.count === 'number' ? primary.count : 0;
      const rpcSafe = typeof rpcCount === 'number' ? rpcCount : 0;
      const finalCount = Math.max(rpcSafe, primaryCount, fallbackCount);
      setStudentCount(finalCount);
    };

    // Initial fetch
    fetchStudentCount();

    // Subscribe to real-time changes on user_roles and activity fallbacks
    const channel = supabase
      .channel('student_count_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
          filter: 'role=eq.student'
        },
        () => fetchStudentCount()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exam_attempts' },
        () => fetchStudentCount()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions' },
        () => fetchStudentCount()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const teacherExams = exams?.filter(exam => exam.created_by === userId) || [];
  const teacherExamIds = teacherExams.map(e => e.id);
  const teacherExamIdsKey = React.useMemo(() => teacherExamIds.join(','), [teacherExamIds]);

  // Fetch average percentage for this teacher's exams and keep it updated in realtime
  React.useEffect(() => {
    const fetchAverages = async () => {
      if (!teacherExamIds || teacherExamIds.length === 0) {
        setAvgPercentage(0);
        setAvgCount(0);
        return;
      }
      const { data, error } = await supabase
        .from('results')
        .select('percentage, exam_id')
        .in('exam_id', teacherExamIds);
      if (error) return; // Silently ignore for UI stability
      const percentages = (data || []).map(r => r.percentage).filter((p): p is number => typeof p === 'number');
      const avg = percentages.length > 0 ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : 0;
      setAvgPercentage(avg);
      setAvgCount(percentages.length);
    };

    fetchAverages();

    // Realtime updates for results and grades tables
    const channel = supabase
      .channel('results_and_grades_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'results' },
        () => {
          fetchAverages();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'grades' },
        () => {
          fetchAverages();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exam_attempts' },
        () => {
          fetchAverages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teacherExamIdsKey]);
  
  // Group submissions by exam for quick counts
  const submissionsByExam: Record<string, number> = (submissions || []).reduce((acc: Record<string, number>, s: { exam_id: string }) => {
    const key = s.exam_id;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  
  const recentActivity = submissions?.slice(0, 4).map(sub => ({
    type: "submission",
    student: sub.profiles?.full_name || sub.profiles?.email || 'Unknown',
    exam: sub.exams?.title || 'Unknown',
    time: new Date(sub.submitted_at).toLocaleString()
  })) || [];

  const handlePublishExam = (examId: string) => {
    updateExamStatus.mutate({ examId, status: 'published' });
  };

  const handleDeleteExam = (examId: string) => {
    if (confirm('Are you sure you want to delete this exam? This will remove all related questions, submissions, and results.')) {
      deleteExam.mutate(examId);
    }
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
            <div className="text-2xl font-bold text-primary">{avgPercentage}%</div>
            <p className="text-xs text-muted-foreground">
              Based on {avgCount} graded submissions
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
          <TabsTrigger value="submissions">All Submissions</TabsTrigger>
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
                        <Button 
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteExam(exam.id)}
                          disabled={deleteExam.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {deleteExam.isPending ? 'Deleting...' : 'Delete'}
                        </Button>
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

        <TabsContent value="submissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Submissions</CardTitle>
              <CardDescription>View all student submissions with grading status</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAllSubmissions ? (
                <p className="text-center text-muted-foreground py-4">Loading submissions...</p>
              ) : !allSubmissions || allSubmissions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No submissions yet</p>
              ) : (
                <div className="space-y-4">
                  {allSubmissions.map((submission) => {
                    const isGraded = submission.status === 'graded';
                    const isInReview = submission.status === 'in_review';
                    
                    return (
                      <div key={submission.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{submission.profiles.full_name}</h3>
                            {isGraded ? (
                              <Badge variant="outline" className="bg-success/10 text-success">
                                Graded
                              </Badge>
                            ) : isInReview ? (
                              <Badge variant="outline" className="bg-warning/10 text-warning">
                                In Review
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                Submitted
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
                                {submission.total_score}/{submission.exams.total_marks}
                              </span>
                              <span className="text-muted-foreground ml-2">
                                ({Math.round((submission.total_score / submission.exams.total_marks) * 100)}%)
                              </span>
                            </div>
                          )}
                        </div>
                        <Button 
                          variant={isGraded ? "outline" : "default"} 
                          size="sm"
                          onClick={() => onGradeSubmission(submission.id)}
                        >
                          {isGraded ? 'View Grade' : 'Grade Now'}
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
