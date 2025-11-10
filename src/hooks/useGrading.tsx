import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export const useGrading = (examId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch submissions that need grading
  const { data: pendingSubmissions, isLoading: isLoadingSubmissions } = useQuery({
    queryKey: ['pending-submissions', examId],
    queryFn: async () => {
      let query = supabase
        .from('submissions')
        .select(`
          id,
          exam_id,
          student_id,
          answers,
          time_taken,
          submitted_at,
          exams!inner(id, title, subject, total_marks, created_by),
          profiles!inner(full_name),
          results(id, score, graded_at, graded_by)
        `)
        .order('submitted_at', { ascending: false });
      
      if (examId) {
        query = query.eq('exam_id', examId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter to show only ungraded submissions or those created by current teacher
      const { data: { user } } = await supabase.auth.getUser();
      return data?.filter((sub: any) => 
        sub.exams.created_by === user?.id
      ) || [];
    },
    enabled: !!examId || true
  });

  // Fetch submission details with questions
  const fetchSubmissionDetails = async (submissionId: string) => {
    const { data: submission } = await supabase
      .from('submissions')
      .select(`
        *,
        exams!inner(id, title, total_marks),
        profiles!inner(full_name, email)
      `)
      .eq('id', submissionId)
      .single();

    if (!submission) throw new Error('Submission not found');

    // Fetch exam questions
    const { data: examQuestions } = await supabase
      .from('exam_questions')
      .select(`
        question_id,
        order_number,
        questions!inner(
          id,
          question_text,
          correct_answer,
          points,
          question_type,
          options
        )
      `)
      .eq('exam_id', submission.exam_id)
      .order('order_number');

    return {
      submission,
      questions: examQuestions || []
    };
  };

  // Grade submission mutation
  const gradeSubmission = useMutation({
    mutationFn: async ({
      submissionId,
      examId,
      studentId,
      score,
      totalMarks,
      feedback
    }: {
      submissionId: string;
      examId: string;
      studentId: string;
      score: number;
      totalMarks: number;
      feedback?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const percentage = Math.round((score / totalMarks) * 100);

      // Check if result already exists
      const { data: existingResult } = await supabase
        .from('results')
        .select('id')
        .eq('submission_id', submissionId)
        .maybeSingle();

      if (existingResult) {
        // Update existing result
        const { error } = await supabase
          .from('results')
          .update({
            score,
            total_marks: totalMarks,
            percentage,
            feedback,
            graded_by: user.id,
            graded_at: new Date().toISOString()
          })
          .eq('id', existingResult.id);

        if (error) throw error;
      } else {
        // Create new result
        const { error } = await supabase
          .from('results')
          .insert({
            submission_id: submissionId,
            exam_id: examId,
            student_id: studentId,
            score,
            total_marks: totalMarks,
            percentage,
            feedback,
            graded_by: user.id,
            graded_at: new Date().toISOString()
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['results'] });
      toast({
        title: 'Success',
        description: 'Submission graded successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  return {
    pendingSubmissions,
    isLoadingSubmissions,
    fetchSubmissionDetails,
    gradeSubmission
  };
};
