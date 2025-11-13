import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export const useResults = (userId?: string, examId?: string) => {
  const queryClient = useQueryClient();
  
  const { data: results, isLoading } = useQuery({
    queryKey: ['results', userId, examId],
    queryFn: async () => {
      let query = supabase
        .from('results')
        .select('*, exams(title, subject, total_marks), profiles(full_name)')
        .order('created_at', { ascending: false });
      
      if (userId) {
        query = query.eq('student_id', userId);
      }
      
      if (examId) {
        query = query.eq('exam_id', examId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
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
