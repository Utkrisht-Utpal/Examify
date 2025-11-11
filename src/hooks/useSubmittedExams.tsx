import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useSubmittedExams = (userId?: string) => {
  const { data: submittedExamIds, isLoading } = useQuery({
    queryKey: ['submittedExams', userId],
    queryFn: async () => {
      if (!userId) return new Set<string>();
      
      const { data, error } = await supabase
        .from('submissions')
        .select('exam_id')
        .eq('student_id', userId);
      
      if (error) throw error;
      return new Set(data?.map(s => s.exam_id) || []);
    },
    enabled: !!userId
  });

  return { submittedExamIds: submittedExamIds || new Set<string>(), isLoading };
};
