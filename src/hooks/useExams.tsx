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
      try {
        console.log('=== FETCHING EXAM ===');
        console.log('Exam ID:', examId);
        
        const { data: exam, error: examError } = await supabase
          .from('exams')
          .select('*')
          .eq('id', examId)
          .maybeSingle();
        
        console.log('Exam data:', exam);
        console.log('Exam error:', examError);
        
        if (examError) {
          console.error('Error fetching exam:', examError);
          throw new Error(`Failed to load exam: ${examError.message}`);
        }
        if (!exam) {
          console.error('No exam found with ID:', examId);
          throw new Error('Exam not found');
        }

        console.log('=== FETCHING EXAM QUESTIONS MAPPING ===');
        // Get exam_questions to get the order
        const { data: examQuestions, error: eqError } = await supabase
          .from('exam_questions')
          .select('question_id, order_number')
          .eq('exam_id', examId)
          .order('order_number');
        
        console.log('Exam questions mapping:', examQuestions);
        console.log('Exam questions error:', eqError);
        
        if (eqError) {
          console.error('Error fetching exam questions mapping:', eqError);
          throw new Error(`Failed to load exam questions: ${eqError.message}`);
        }

        if (!examQuestions || examQuestions.length === 0) {
          console.warn('No exam questions found for exam:', examId);
          return {
            ...exam,
            questions: []
          };
        }

        console.log('=== FETCHING QUESTIONS ===');
        // Get questions separately with proper RLS
        const questionIds = examQuestions.map(eq => eq.question_id);
        console.log('Question IDs to fetch:', questionIds);
        
        const { data: questions, error: questionsError } = await supabase
          .from('questions')
          .select('*')
          .in('id', questionIds);
        
        console.log('Questions data:', questions);
        console.log('Questions error:', questionsError);
        
        if (questionsError) {
          console.error('Error fetching questions:', questionsError);
          throw new Error(`Failed to load questions: ${questionsError.message}`);
        }

        if (!questions || questions.length === 0) {
          console.warn('No questions found for exam', examId);
          return {
            ...exam,
            questions: []
          };
        }

        console.log('=== CHECKING USER ROLE ===');
        // Check if user is a student - if so, remove correct_answer field
        const { data: { user } } = await supabase.auth.getUser();
        console.log('Current user:', user?.email);
        
        if (!user) {
          throw new Error('User not authenticated');
        }

        const { data: userRoles, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        
        console.log('User roles:', userRoles);
        console.log('Roles error:', rolesError);
        
        if (rolesError) {
          console.error('Error fetching user roles:', rolesError);
        }
        
        const isStudent = userRoles?.some(r => r.role === 'student');
        console.log('Is student:', isStudent);
        
        // Map questions back in the correct order and sanitize for students
        const orderedQuestions = examQuestions
          .map(eq => {
            const question = questions?.find(q => q.id === eq.question_id);
            if (!question) {
              console.warn('Question not found:', eq.question_id);
              return null;
            }
            
            // Remove correct_answer for students to prevent cheating
            if (isStudent) {
              const { correct_answer, ...sanitizedQuestion } = question;
              return sanitizedQuestion;
            }
            
            return question;
          })
          .filter(q => q !== null && q !== undefined);

        if (orderedQuestions.length === 0) {
          console.error('No questions could be loaded after ordering');
        }

        console.log('=== FINAL RESULT ===');
        console.log('Total questions loaded:', orderedQuestions.length);
        console.log('Questions:', orderedQuestions);

        const result = {
          ...exam,
          questions: orderedQuestions
        };
        
        console.log('Returning exam with questions:', result);
        return result;
      } catch (error) {
        console.error('=== ERROR IN useExamWithQuestions ===');
        console.error('Error details:', error);
        throw error;
      }
    },
    enabled: !!examId,
    retry: 2,
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });
};
