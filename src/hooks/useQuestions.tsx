import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export const useQuestions = (subject?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: questions, isLoading } = useQuery({
    queryKey: ['questions', subject],
    queryFn: async () => {
      let query = supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (subject) {
        query = query.eq('subject', subject);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const createQuestion = useMutation({
    mutationFn: async (questionData: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('questions')
        .insert({
          ...questionData,
          created_by: user.id
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    }
  });

  return { questions, isLoading, createQuestion };
};
