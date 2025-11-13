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
          .select('*, exams(title, subject), profiles:profiles!submissions_student_id_fkey(full_name, email)')
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
        .select('*, exams(title, subject), profiles:profiles!submissions_student_id_fkey(full_name, email)')
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

      // Check if exam_attempt already exists
      const { data: existingAttempt } = await supabase
        .from('exam_attempts')
        .select('id, status')
        .eq('exam_id', examId)
        .eq('student_id', user.id)
        .maybeSingle();

      // Prevent resubmission if already submitted
      if (existingAttempt && existingAttempt.status !== 'draft') {
        throw new Error('You have already submitted this exam');
      }

      let attemptData;
      if (existingAttempt) {
        // Update existing draft attempt to submitted
        const { data, error } = await supabase
          .from('exam_attempts')
          .update({
            answers,
            time_taken: timeTaken,
            status: 'submitted',
            submitted_at: new Date().toISOString()
          })
          .eq('id', existingAttempt.id)
          .select()
          .single();
        
        if (error) throw error;
        attemptData = data;
      } else {
        // Create new attempt as submitted
        const { data, error } = await supabase
          .from('exam_attempts')
          .insert({
            exam_id: examId,
            student_id: user.id,
            answers,
            time_taken: timeTaken,
            status: 'submitted',
            submitted_at: new Date().toISOString(),
            started_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) throw error;
        attemptData = data;
      }

      // Also insert into submissions table for backward compatibility
      const { error: submissionError } = await supabase
        .from('submissions')
        .upsert({
          id: attemptData.id,
          exam_id: examId,
          student_id: user.id,
          answers,
          time_taken: timeTaken,
          submitted_at: attemptData.submitted_at
        }, {
          onConflict: 'exam_id,student_id'
        });
      
      if (submissionError) console.warn('Failed to sync with submissions table:', submissionError);
      
      return attemptData;
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
