import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, BookOpen, Users, BarChart3, FileText, Calendar, Eye } from "lucide-react";

interface TeacherDashboardProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
  onCreateExam: () => void;
  onViewResults: () => void;
}

export const TeacherDashboard = ({ user, onCreateExam, onViewResults }: TeacherDashboardProps) => {
  const [exams] = useState([
    {
      id: "1",
      title: "Mathematics Final Exam",
      subject: "Mathematics",
      duration: 120,
      questions: 50,
      studentsEnrolled: 45,
      studentsCompleted: 23,
      averageScore: 85,
      status: "active",
      createdDate: "2024-01-15"
    },
    {
      id: "2",
      title: "Physics Mid-term",
      subject: "Physics", 
      duration: 90,
      questions: 40,
      studentsEnrolled: 38,
      studentsCompleted: 38,
      averageScore: 78,
      status: "completed",
      createdDate: "2024-01-10"
    },
    {
      id: "3",
      title: "Chemistry Quiz",
      subject: "Chemistry",
      duration: 30,
      questions: 20,
      studentsEnrolled: 42,
      studentsCompleted: 0,
      averageScore: 0,
      status: "draft",
      createdDate: "2024-01-18"
    }
  ]);

  const [recentActivity] = useState([
    { type: "submission", student: "John Smith", exam: "Mathematics Final", time: "2 hours ago" },
    { type: "submission", student: "Emma Wilson", exam: "Mathematics Final", time: "3 hours ago" },
    { type: "exam_created", student: "", exam: "Chemistry Quiz", time: "1 day ago" },
    { type: "submission", student: "Michael Brown", exam: "Physics Mid-term", time: "2 days ago" }
  ]);

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
            <div className="text-2xl font-bold">{exams.length}</div>
            <p className="text-xs text-muted-foreground">
              {exams.filter(e => e.status === "active").length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">125</div>
            <p className="text-xs text-muted-foreground">
              Across all subjects
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
            <div className="text-2xl font-bold text-success">61</div>
            <p className="text-xs text-muted-foreground">
              This week
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="exams" className="space-y-4">
        <TabsList>
          <TabsTrigger value="exams">My Exams</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="exams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exam Management</CardTitle>
              <CardDescription>Create, edit, and monitor your exams</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {exams.map((exam) => (
                  <div key={exam.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{exam.title}</h3>
                        <Badge className={getStatusColor(exam.status)}>
                          {exam.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {exam.subject}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {exam.studentsCompleted}/{exam.studentsEnrolled} completed
                        </div>
                        <div className="flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" />
                          Avg: {exam.averageScore}%
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {exam.createdDate}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button variant="outline" size="sm" onClick={onViewResults}>
                        Results
                      </Button>
                      {exam.status === "draft" && (
                        <Button size="sm">
                          Publish
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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