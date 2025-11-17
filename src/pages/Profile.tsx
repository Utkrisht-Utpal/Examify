import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Award, BarChart3, BookOpen, Calendar, Clock, Mail, User as UserIcon, Users } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type ProfileRow = Tables<"profiles"> & {
  avatar_url?: string | null;
  role?: string | null;
  certificates?: string[] | null;
};

type StudentExamSummary = {
  id: string;
  title: string;
  subject?: string | null;
  takenAt: string | null;
  score: number;
  totalMarks: number;
  percentage: number;
};

type UpcomingExam = {
  id: string;
  title: string;
  subject: string;
  startTime: string | null;
  endTime: string | null;
};

type TeacherExamSummary = {
  id: string;
  title: string;
  createdAt: string | null;
  totalMarks: number;
  studentsAppeared: number;
  avgPercentage: number | null;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
};

const Profile = () => {
  const { user, effectiveRole, loading, initialChecked, session } = useAuth();
  const navigate = useNavigate();

  const [profileRow, setProfileRow] = useState<ProfileRow | null>(null);
  const [studentExams, setStudentExams] = useState<StudentExamSummary[]>([]);
  const [upcomingExams, setUpcomingExams] = useState<UpcomingExam[]>([]);
  const [teacherExams, setTeacherExams] = useState<TeacherExamSummary[]>([]);
  const [pendingEvaluations, setPendingEvaluations] = useState<{
    id: string;
    examTitle: string;
    studentName: string;
    submittedAt: string | null;
    status: string;
  }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authReady = initialChecked && !loading;

  const finalRole: "student" | "teacher" | "admin" = useMemo(() => {
    const metaRole = (user?.user_metadata as { role?: string } | null)?.role;
    if (effectiveRole === "student" || effectiveRole === "teacher") return effectiveRole;
    if (metaRole === "student" || metaRole === "teacher" || metaRole === "admin") return metaRole;
    return "student";
  }, [effectiveRole, user]);

  const fullName = useMemo(() => {
    const metaName = (user?.user_metadata as { full_name?: string } | null)?.full_name;
    return (
      metaName ||
      profileRow?.full_name ||
      user?.email?.split("@")[0] ||
      "User"
    );
  }, [profileRow?.full_name, user]);

  const email = user?.email || profileRow?.email || "-";

  const joinedDate = useMemo(() => {
    const fromProfile = profileRow?.created_at;
    const fromAuth = (user as { created_at?: string } | null | undefined)?.created_at;
    return fromProfile || fromAuth || null;
  }, [profileRow?.created_at, user]);

  const avgScore = useMemo(() => {
    if (!studentExams.length) return 0;
    const total = studentExams.reduce((acc, exam) => acc + exam.score, 0);
    return Math.round(total / studentExams.length);
  }, [studentExams]);

  const avgPercentage = useMemo(() => {
    if (!studentExams.length) return 0;
    const total = studentExams.reduce((acc, exam) => acc + exam.percentage, 0);
    return Math.round(total / studentExams.length);
  }, [studentExams]);

  useEffect(() => {
    if (!authReady) return;

    if (!user || !session) {
      navigate("/login", { replace: true });
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch profile row (includes joined date and any optional metadata)
        const { data: rawProfile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.warn("Profile query failed", profileError);
        }

        const typedProfile = (rawProfile || null) as ProfileRow | null;

        if (!cancelled) {
          setProfileRow(typedProfile);
        }

        // Student-centric data
        let studentExamSummaries: StudentExamSummary[] = [];
        let upcomingExamSummaries: UpcomingExam[] = [];

        if (finalRole === "student" || finalRole === "admin") {
          // Graded results joined with exams
          const { data: resultsData, error: resultsError } = await supabase
            .from("results")
            .select(
              "id, exam_id, score, total_marks, percentage, created_at, exams(title, subject, start_time, end_time)"
            )
            .eq("student_id", user.id)
            .order("created_at", { ascending: false });

          if (resultsError) {
            console.warn("Results query failed", resultsError);
          } else if (resultsData) {
            studentExamSummaries = resultsData.map((row) => ({
              id: row.id as string,
              title: (row as { exams?: { title?: string } }).exams?.title ?? "Exam",
              subject: (row as { exams?: { subject?: string | null } }).exams?.subject ?? null,
              takenAt: row.created_at as string | null,
              score: (row.score ?? 0) as number,
              totalMarks: (row.total_marks ?? 0) as number,
              percentage: (row.percentage ?? 0) as number,
            }));
          }

          // Submitted exam IDs so we don't treat them as upcoming
          const { data: submitted, error: submittedError } = await supabase
            .from("submissions")
            .select("exam_id")
            .eq("student_id", user.id);

          if (submittedError) {
            console.warn("Submissions query failed", submittedError);
          }

          const submittedIds = new Set<string>((submitted || []).map((s) => s.exam_id as string));
          const nowIso = new Date().toISOString();

          const { data: upcoming, error: upcomingError } = await supabase
            .from("exams")
            .select("id, title, subject, start_time, end_time, status")
            .eq("status", "published")
            .gt("start_time", nowIso)
            .order("start_time", { ascending: true });

          if (upcomingError) {
            console.warn("Upcoming exams query failed", upcomingError);
          } else if (upcoming) {
            upcomingExamSummaries = upcoming
              .filter((exam) => !submittedIds.has(exam.id as string))
              .map((exam) => ({
                id: exam.id as string,
                title: exam.title as string,
                subject: exam.subject as string,
                startTime: exam.start_time as string | null,
                endTime: exam.end_time as string | null,
              }));
          }
        }

        // Teacher-centric data
        let teacherExamSummaries: TeacherExamSummary[] = [];
        let pending: {
          id: string;
          examTitle: string;
          studentName: string;
          submittedAt: string | null;
          status: string;
        }[] = [];

        if (finalRole === "teacher" || finalRole === "admin") {
          const { data: teacherExamsData, error: teacherExamsError } = await supabase
            .from("exams")
            .select("id, title, created_at, total_marks")
            .eq("created_by", user.id)
            .order("created_at", { ascending: false });

          if (teacherExamsError) {
            console.warn("Teacher exams query failed", teacherExamsError);
          }

          const examIds = (teacherExamsData || []).map((e) => e.id as string);

          let submissionsByExam: Record<string, { distinctStudents: Set<string> }> = {};
          let avgByExam: Record<string, { totalScore: number; totalMarks: number }> = {};

          if (examIds.length > 0) {
            const { data: submissionsData, error: submissionsError } = await supabase
              .from("submissions")
              .select("exam_id, student_id")
              .in("exam_id", examIds);

            if (submissionsError) {
              console.warn("Teacher submissions query failed", submissionsError);
            } else if (submissionsData) {
              submissionsByExam = (submissionsData).reduce<Record<string, { distinctStudents: Set<string> }>>((acc, row) => {
                const examId = row.exam_id as string;
                const studentId = row.student_id as string;
                if (!acc[examId]) acc[examId] = { distinctStudents: new Set<string>() };
                if (studentId) acc[examId].distinctStudents.add(studentId);
                return acc;
              }, {});
            }

            const { data: resultsForTeacher, error: resultsForTeacherError } = await supabase
              .from("results")
              .select("exam_id, score, total_marks")
              .in("exam_id", examIds);

            if (resultsForTeacherError) {
              console.warn("Teacher results query failed", resultsForTeacherError);
            } else if (resultsForTeacher) {
              avgByExam = resultsForTeacher.reduce<Record<string, { totalScore: number; totalMarks: number }>>((acc, row) => {
                const examId = row.exam_id as string;
                const score = (row.score ?? 0) as number;
                const totalMarks = (row.total_marks ?? 0) as number;
                if (!acc[examId]) acc[examId] = { totalScore: 0, totalMarks: 0 };
                acc[examId].totalScore += score;
                acc[examId].totalMarks += totalMarks || 0;
                return acc;
              }, {});
            }

            const { data: pendingAttempts, error: pendingError } = await supabase
              .from("exam_attempts")
              .select(
                "id, exam_id, submitted_at, status, exams(title), profiles(full_name)"
              )
              .in("exam_id", examIds)
              .in("status", ["submitted", "in_review"])
              .order("submitted_at", { ascending: false });

            if (pendingError) {
              console.warn("Pending attempts query failed", pendingError);
            } else if (pendingAttempts) {
              pending = pendingAttempts.map((row) => ({
                id: row.id as string,
                examTitle: (row as { exams?: { title?: string } }).exams?.title ?? "Exam",
                studentName: (row as { profiles?: { full_name?: string } }).profiles?.full_name ?? "Student",
                submittedAt: row.submitted_at as string | null,
                status: (row.status ?? "submitted") as string,
              }));
            }
          }

          teacherExamSummaries = (teacherExamsData || []).map((exam) => {
            const examId = exam.id as string;
            const subInfo = submissionsByExam[examId];
            const avgInfo = avgByExam[examId];

            const studentsAppeared = subInfo ? subInfo.distinctStudents.size : 0;
            const avgPerc = avgInfo && avgInfo.totalMarks > 0
              ? Math.round((avgInfo.totalScore / avgInfo.totalMarks) * 100)
              : null;

            return {
              id: examId,
              title: exam.title as string,
              createdAt: exam.created_at as string | null,
              totalMarks: (exam.total_marks ?? 0) as number,
              studentsAppeared,
              avgPercentage: avgPerc,
            };
          });
        }

        if (!cancelled) {
          setStudentExams(studentExamSummaries);
          setUpcomingExams(upcomingExamSummaries);
          setTeacherExams(teacherExamSummaries);
          setPendingEvaluations(pending);
        }
      } catch (e) {
        console.error("Profile page data load error", e);
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "Failed to load profile data.";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [authReady, finalRole, navigate, session, user]);

  const totalExamsGiven = studentExams.length;
  const upcomingCount = upcomingExams.length;
  const teacherTotalExams = teacherExams.length;
  const pendingCount = pendingEvaluations.length;

  const totalStudentsAppeared = useMemo(
    () => teacherExams.reduce((acc, exam) => acc + exam.studentsAppeared, 0),
    [teacherExams],
  );

  const teacherOverallAvgPercentage = useMemo(() => {
    const valid = teacherExams.filter((exam) => exam.avgPercentage != null);
    if (!valid.length) return null;
    const sum = valid.reduce((acc, exam) => acc + (exam.avgPercentage ?? 0), 0);
    return Math.round(sum / valid.length);
  }, [teacherExams]);

  const showStudentSections = finalRole === "student";
  const showTeacherSections = finalRole === "teacher" || finalRole === "admin";

  // Ensure the default tab always exists in the current TabList configuration
  const defaultTab: "attempts" | "created" | "pending" = showStudentSections
    ? "attempts"
    : showTeacherSections
      ? "created"
      : "attempts";

  if (!authReady || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>Profile Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {error}
            </p>
            <Button variant="outline" onClick={() => navigate("/", { replace: true })}>
              Back to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const roleLabel = finalRole.charAt(0).toUpperCase() + finalRole.slice(1);
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const totalExamsGiven = studentExams.length;
  const upcomingCount = upcomingExams.length;
  const teacherTotalExams = teacherExams.length;
  const pendingCount = pendingEvaluations.length;

  return (
    ? "attempts"
    : showTeacherSections
      ? "created"
      : "attempts";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header with avatar and basic info */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{fullName}</h1>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/30">
                  {roleLabel}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {email}
                </span>
                <Separator orientation="vertical" className="h-4 hidden md:block" />
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Joined {formatDate(joinedDate)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/", { replace: true })}>
              Back to dashboard
            </Button>
            <Button size="sm" variant="outline" onClick={() => console.log("Edit profile clicked")}> 
              Edit profile
            </Button>
          </div>
        </div>

        {/* Stats row - student vs teacher specific */}
        {showStudentSections && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalExamsGiven}</div>
                <p className="text-xs text-muted-foreground">Exams you have completed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {avgScore}
                  <span className="text-sm text-muted-foreground ml-1">marks</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {avgPercentage}% average across graded exams
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Attempts</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalExamsGiven}</div>
                <p className="text-xs text-muted-foreground">Graded exam attempts</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">{upcomingCount}</div>
                <p className="text-xs text-muted-foreground">Upcoming exams</p>
              </CardContent>
            </Card>
          </div>
        )}

        {showTeacherSections && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Exams Created</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teacherTotalExams}</div>
                <p className="text-xs text-muted-foreground">Exams you have authored</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Students Appeared</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalStudentsAppeared}</div>
                <p className="text-xs text-muted-foreground">Unique students across your exams</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {teacherOverallAvgPercentage ?? 0}
                  <span className="text-sm text-muted-foreground ml-1">%</span>
                </div>
                <p className="text-xs text-muted-foreground">Average percentage across your exams</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Evaluations</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">{pendingCount}</div>
                <p className="text-xs text-muted-foreground">Submissions waiting for review</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main two-column layout */}
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)]">
          {/* Left: profile details */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile details</CardTitle>
                <CardDescription>Your basic account information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Full name</p>
                    <p className="font-medium">{fullName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Role</p>
                    <p className="font-medium">{roleLabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Joined</p>
                    <p className="font-medium">{formatDate(joinedDate)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Certificates</CardTitle>
                <CardDescription>Verified achievements and completions</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No certificates have been linked yet. If you track certificates in a
                  dedicated table (for example, <code className="font-mono text-xs">certificates</code> or
                  <code className="font-mono text-xs">profiles.certificates</code>), you can surface them here.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right: tabbed lists */}
          <div className="space-y-4">
            <Tabs defaultValue={defaultTab} className="space-y-4">
              <TabsList>
                {showStudentSections && (
                  <TabsTrigger value="attempts">Attempts</TabsTrigger>
                )}
                {showTeacherSections && (
                  <TabsTrigger value="created">Created Exams</TabsTrigger>
                )}
                {showTeacherSections && (
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                )}
              </TabsList>

              {showStudentSections && (
                <TabsContent value="attempts" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Your exam attempts</CardTitle>
                    <CardDescription>Recently graded exams</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {studentExams.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No graded exams yet. Once you complete exams, your attempts will appear here.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {studentExams.map((exam) => (
                          <div
                            key={exam.id}
                            className="flex items-center justify-between p-4 border rounded-lg bg-card/40"
                          >
                            <div className="space-y-1">
                              <p className="font-medium">{exam.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {exam.subject && <span className="mr-2">{exam.subject}</span>}
                                Taken on {formatDate(exam.takenAt)}
                              </p>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="font-semibold">
                                {exam.score}/{exam.totalMarks}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {exam.percentage}%
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Upcoming exams</CardTitle>
                    <CardDescription>Published exams you have not yet submitted</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {upcomingExams.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No upcoming exams found.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {upcomingExams.map((exam) => (
                          <div
                            key={exam.id}
                            className="flex items-center justify-between p-4 border rounded-lg bg-card/40"
                          >
                            <div className="space-y-1">
                              <p className="font-medium">{exam.title}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-2">
                                <span>{exam.subject}</span>
                                {exam.startTime && (
                                  <>
                                    <span>•</span>
                                    <span>Starts {formatDateTime(exam.startTime)}</span>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              )}

              {showTeacherSections && (
              <TabsContent value="created" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Exams you created</CardTitle>
                    <CardDescription>
                      {finalRole === "teacher"
                        ? "Overview of your authored exams with basic analytics"
                        : "You do not have teacher permissions. If you also teach, your created exams will appear here."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {teacherExams.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No exams found for this teacher account.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {teacherExams.map((exam) => (
                          <div
                            key={exam.id}
                            className="flex items-center justify-between p-4 border rounded-lg bg-card/40"
                          >
                            <div className="space-y-1">
                              <p className="font-medium">{exam.title}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-2">
                                <span>Created {formatDate(exam.createdAt)}</span>
                                <span>•</span>
                                <span>{exam.totalMarks} marks</span>
                              </p>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-sm">
                                {exam.studentsAppeared} students appeared
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Avg. score:{" "}
                                {exam.avgPercentage != null ? `${exam.avgPercentage}%` : "N/A"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              )}

              {showTeacherSections && (
              <TabsContent value="pending" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Pending evaluations</CardTitle>
                    <CardDescription>
                      {finalRole === "teacher"
                        ? "Submissions for your exams that still need grading or review"
                        : "Pending grading for teacher-owned exams. As a student, you can check status from your results view."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pendingEvaluations.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No pending evaluations right now.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {pendingEvaluations.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-4 border rounded-lg bg-card/40"
                          >
                            <div className="space-y-1">
                              <p className="font-medium">{item.examTitle}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.studentName} • Submitted {formatDateTime(item.submittedAt)}
                              </p>
                            </div>
                            <Badge
                              variant={item.status === "in_review" ? "outline" : "destructive"}
                              className={
                                item.status === "in_review"
                                  ? "bg-warning/10 text-warning border-warning/30"
                                  : "bg-destructive/10 text-destructive border-destructive/40"
                              }
                            >
                              {item.status === "in_review" ? "In review" : "Pending"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
