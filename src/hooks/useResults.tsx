import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export const useResults = (userId?: string, examId?: string) => {
  const queryClient = useQueryClient();
  
  const { data: results, isLoading } = useQuery({
    queryKey: ['results', userId, examId],
    queryFn: async () => {
      // Query graded exam_attempts with results data for backwards compatibility
      let attemptsQuery = supabase
        .from('exam_attempts')
        .select(`
          id,
          exam_id,
          student_id,
          status,
          total_score,
          submitted_at,
          graded_at,
          exams(title, subject, total_marks),
          profiles(full_name)
        `)
        .eq('status', 'graded')
        .order('graded_at', { ascending: false });
      
      if (userId) {
        attemptsQuery = attemptsQuery.eq('student_id', userId);
      }
      
      if (examId) {
        attemptsQuery = attemptsQuery.eq('exam_id', examId);
      }

      const { data: attempts, error: attemptsError } = await attemptsQuery;
      if (attemptsError) throw attemptsError;

      // Transform to match old results format
      const transformedResults = attempts?.map(attempt => {
        const percentage = attempt.exams?.total_marks 
          ? Math.round((attempt.total_score / attempt.exams.total_marks) * 100)
          : 0;
        
        return {
          id: attempt.id,
          submission_id: attempt.id,
          exam_id: attempt.exam_id,
          student_id: attempt.student_id,
          score: attempt.total_score,
          total_marks: attempt.exams?.total_marks || 0,
          percentage,
          created_at: attempt.graded_at || attempt.submitted_at,
          exams: attempt.exams,
          profiles: attempt.profiles,
          graded_at: attempt.graded_at
        };
      }) || [];

      // Also fetch results table data for backward compatibility and feedback
      let resultsQuery = supabase
        .from('results')
        .select('*, exams(title, subject, total_marks), profiles(full_name)')
        .order('created_at', { ascending: false });
      
      if (userId) {
        resultsQuery = resultsQuery.eq('student_id', userId);
      }
      
      if (examId) {
        resultsQuery = resultsQuery.eq('exam_id', examId);
      }

      const { data: oldResults, error: resultsError } = await resultsQuery;
      if (resultsError) console.warn('Results table query failed:', resultsError);

      // Merge both sources, prioritizing exam_attempts for graded exams
      const mergedResults = transformedResults.map(transformed => {
        const oldResult = oldResults?.find(r => r.submission_id === transformed.id);
        return {
          ...transformed,
          feedback: oldResult?.feedback || null,
          graded_by: oldResult?.graded_by || null
        };
      });

      return mergedResults;
    },
    enabled: !!userId || !!examId // Only run when we have userId or examId
  });

  // Set up realtime subscriptions for results, grades, and exam_attempts
  useEffect(() => {
    if (!userId && !examId) return;

    const channel = supabase
      .channel('results_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'results' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['results', userId, examId] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'grades' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['results', userId, examId] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exam_attempts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['results', userId, examId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, examId, queryClient]);

  return { results, isLoading };
};
