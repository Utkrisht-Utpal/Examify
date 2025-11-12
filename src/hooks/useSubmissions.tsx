import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export const useSubmissions = (examId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: submissions, isLoading } = useQuery({
    queryKey: ['submissions', examId],
    queryFn: async () => {
      // If a specific examId is provided, just fetch its submissions
      if (examId) {
        const { data, error } = await supabase
          .from('submissions')
          .select('*, exams(title, subject), profiles(full_name)')
          .eq('exam_id', examId)
          .order('submitted_at', { ascending: false });
        if (error) throw error;
        return data;
      }

      // Otherwise, fetch submissions only for exams created by the current teacher
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: teacherExams, error: examsError } = await supabase
        .from('exams')
        .select('id')
        .eq('created_by', user.id);
      if (examsError) throw examsError;
      if (!teacherExams || teacherExams.length === 0) return [];

      const examIds = teacherExams.map(e => e.id);
      const { data, error } = await supabase
        .from('submissions')
        .select('*, exams(title, subject), profiles(full_name)')
        .in('exam_id', examIds)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    // Always enabled so the teacher dashboard can load overall submissions
    enabled: true,
  });

  const submitExam = useMutation({
    mutationFn: async ({ examId, answers, timeTaken }: { 
      examId: string; 
      answers: Record<string, string>;
      timeTaken: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('submissions')
        .insert({
          exam_id: examId,
          student_id: user.id,
          answers,
          time_taken: timeTaken
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      queryClient.invalidateQueries({ queryKey: ['pending-submissions'] });
      toast({
        title: 'Submitted',
        description: 'Your exam was submitted and is awaiting teacher grading.'
      });
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  });

  return { submissions, isLoading, submitExam };
};
