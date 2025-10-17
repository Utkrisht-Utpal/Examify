import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useResults = (userId?: string, examId?: string) => {
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
    }
  });

  return { results, isLoading };
};
