import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export const useSubmissions = (examId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: submissions, isLoading } = useQuery({
    queryKey: ['submissions', examId],
    queryFn: async () => {
      let query = supabase
        .from('submissions')
        .select('*, exams(title, subject), profiles(full_name)')
        .order('submitted_at', { ascending: false });
      
      if (examId) {
        query = query.eq('exam_id', examId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!examId
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
      toast({
        title: 'Success',
        description: 'Exam submitted successfully'
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

  return { submissions, isLoading, submitExam };
};
