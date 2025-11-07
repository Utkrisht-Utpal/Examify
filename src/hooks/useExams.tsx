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
    }
  });

  const updateExamStatus = useMutation({
    mutationFn: async ({ examId, status }: { examId: string; status: 'draft' | 'published' | 'archived' }) => {
      const { data, error } = await supabase
        .from('exams')
        .update({ status })
        .eq('id', examId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast({
        title: 'Success',
        description: `Exam ${data.status === 'published' ? 'published' : 'updated'} successfully`
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

  return { exams, isLoading, createExam, updateExamStatus };
};

export const useExamWithQuestions = (examId: string) => {
  return useQuery({
    queryKey: ['exam', examId],
    queryFn: async () => {
      const { data: exam, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .maybeSingle();
      
      if (examError) throw examError;
      if (!exam) throw new Error('Exam not found');

      // Get exam_questions to get the order
      const { data: examQuestions, error: eqError } = await supabase
        .from('exam_questions')
        .select('question_id, order_number')
        .eq('exam_id', examId)
        .order('order_number');
      
      if (eqError) throw eqError;

      if (!examQuestions || examQuestions.length === 0) {
        return {
          ...exam,
          questions: []
        };
      }

      // Get questions separately with proper RLS
      const questionIds = examQuestions.map(eq => eq.question_id);
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .in('id', questionIds);
      
      if (questionsError) throw questionsError;

      // Map questions back in the correct order
      const orderedQuestions = examQuestions
        .map(eq => questions?.find(q => q.id === eq.question_id))
        .filter(q => q !== null && q !== undefined);

      return {
        ...exam,
        questions: orderedQuestions
      };
    },
    enabled: !!examId,
    retry: 1
  });
};
