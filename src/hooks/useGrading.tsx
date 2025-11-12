import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export const useGrading = (examId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch submissions that need grading
  const { data: pendingSubmissions, isLoading: isLoadingSubmissions, error: submissionsError } = useQuery({
    queryKey: ['pending-submissions', examId],
    queryFn: async () => {
      try {
        console.log('=== FETCHING PENDING SUBMISSIONS ===');
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        
        console.log('Current user:', user.email);
        
        // Get all exams created by this teacher
        const { data: teacherExams, error: examsError } = await supabase
          .from('exams')
          .select('id')
          .eq('created_by', user.id);
        
        if (examsError) throw examsError;
        if (!teacherExams || teacherExams.length === 0) {
          console.log('No exams created by teacher');
          return [];
        }
        
        const examIds = teacherExams.map(e => e.id);
        console.log('Teacher exam IDs:', examIds);
        
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
          .in('exam_id', examIds)
          .order('submitted_at', { ascending: false });
        
        if (examId) {
          query = query.eq('exam_id', examId);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        console.log('Fetched submissions:', data?.length);
        return data || [];
      } catch (error) {
        console.error('Error fetching pending submissions:', error);
        throw error;
      }
    },
    enabled: true
  });

  // Fetch submission details with questions
  const fetchSubmissionDetails = async (submissionId: string) => {
    const { data: submission, error } = await supabase
      .from('submissions')
      .select(`
        *,
        exams!inner(id, title, total_marks),
        profiles!inner(full_name, email)
      `)
      .eq('id', submissionId)
      .maybeSingle();

    if (error) throw error;
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
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  });

  return {
    pendingSubmissions,
    isLoadingSubmissions,
    submissionsError,
    fetchSubmissionDetails,
    gradeSubmission
  };
};
