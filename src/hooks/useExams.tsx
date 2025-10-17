import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export const useExams = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: exams, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const createExam = useMutation({
    mutationFn: async (examData: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('exams')
        .insert({
          ...examData,
          created_by: user.id
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast({
        title: 'Success',
        description: 'Exam created successfully'
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

  return { exams, isLoading, createExam };
};

export const useExamWithQuestions = (examId: string) => {
  return useQuery({
    queryKey: ['exam', examId],
    queryFn: async () => {
      const { data: exam, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single();
      
      if (examError) throw examError;

      const { data: examQuestions, error: questionsError } = await supabase
        .from('exam_questions')
        .select('*, questions(*)')
        .eq('exam_id', examId)
        .order('order_number');
      
      if (questionsError) throw questionsError;

      return {
        ...exam,
        questions: examQuestions.map(eq => eq.questions)
      };
    },
    enabled: !!examId
  });
};
