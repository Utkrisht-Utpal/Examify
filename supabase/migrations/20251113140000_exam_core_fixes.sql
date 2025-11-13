-- Migration: Exam Core Fixes
-- This migration addresses:
-- 1. ON DELETE CASCADE for proper exam deletion
-- 2. Options table for MCQ with correct_option_id
-- 3. RPC functions for safe exam deletion and MCQ auto-grading
-- 4. Helper functions for role checking
-- 5. Backfill and cleanup for existing data

-- ====================================
-- PART 1: Create helper functions
-- ====================================

-- Create is_teacher() helper function
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'teacher'
  )
$$;

-- Create is_admin() helper function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

-- Create is_student() helper function
CREATE OR REPLACE FUNCTION public.is_student()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'student'
  )
$$;

-- ====================================
-- PART 2: Create options table for MCQ
-- ====================================

-- Create options table for MCQ questions
CREATE TABLE IF NOT EXISTS public.options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  option_text TEXT NOT NULL,
  option_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(question_id, option_order)
);

-- Enable RLS on options
ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;

-- RLS Policies for options (same visibility as questions)
CREATE POLICY "Options visible with questions"
  ON public.options
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.questions q
      WHERE q.id = options.question_id
        AND (
          public.has_role(auth.uid(), 'teacher') OR 
          public.has_role(auth.uid(), 'admin') OR
          EXISTS (
            SELECT 1 FROM public.exam_questions eq
            JOIN public.exams e ON e.id = eq.exam_id
            WHERE eq.question_id = q.id AND e.status = 'published'
          )
        )
    )
  );

CREATE POLICY "Teachers can manage options"
  ON public.options
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.questions q
      WHERE q.id = options.question_id
        AND (q.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- Add indexes for options
CREATE INDEX IF NOT EXISTS idx_options_question_id ON public.options(question_id);

-- ====================================
-- PART 3: Modify questions table
-- ====================================

-- Add correct_option_id to questions (for MCQ)
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS correct_option_id UUID REFERENCES public.options(id) ON DELETE SET NULL;

-- Add index for correct_option_id
CREATE INDEX IF NOT EXISTS idx_questions_correct_option_id ON public.questions(correct_option_id);

-- ====================================
-- PART 4: Modify grades table
-- ====================================

-- Add is_correct to grades table if not exists
ALTER TABLE public.grades 
ADD COLUMN IF NOT EXISTS is_correct BOOLEAN;

-- Add selected_option_id to track student's MCQ answer
ALTER TABLE public.grades
ADD COLUMN IF NOT EXISTS selected_option_id UUID REFERENCES public.options(id) ON DELETE SET NULL;

-- Add index
CREATE INDEX IF NOT EXISTS idx_grades_selected_option_id ON public.grades(selected_option_id);

-- ====================================
-- PART 5: Ensure CASCADE deletes are properly set
-- ====================================

-- Drop and recreate foreign keys with ON DELETE CASCADE for exam_questions
ALTER TABLE public.exam_questions DROP CONSTRAINT IF EXISTS exam_questions_exam_id_fkey;
ALTER TABLE public.exam_questions DROP CONSTRAINT IF EXISTS exam_questions_question_id_fkey;

ALTER TABLE public.exam_questions
  ADD CONSTRAINT exam_questions_exam_id_fkey 
  FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

ALTER TABLE public.exam_questions
  ADD CONSTRAINT exam_questions_question_id_fkey 
  FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;

-- Ensure exam_attempts has CASCADE (should already exist from previous migration)
ALTER TABLE public.exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_exam_id_fkey;
ALTER TABLE public.exam_attempts
  ADD CONSTRAINT exam_attempts_exam_id_fkey 
  FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

-- Ensure grades has CASCADE (should already exist)
ALTER TABLE public.grades DROP CONSTRAINT IF EXISTS grades_attempt_id_fkey;
ALTER TABLE public.grades
  ADD CONSTRAINT grades_attempt_id_fkey 
  FOREIGN KEY (attempt_id) REFERENCES public.exam_attempts(id) ON DELETE CASCADE;

-- Ensure submissions CASCADE (for backward compatibility)
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_exam_id_fkey;
ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_exam_id_fkey 
  FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

-- Ensure results CASCADE
ALTER TABLE public.results DROP CONSTRAINT IF EXISTS results_exam_id_fkey;
ALTER TABLE public.results
  ADD CONSTRAINT results_exam_id_fkey 
  FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

-- ====================================
-- PART 6: Create RPC function for safe exam deletion
-- ====================================

CREATE OR REPLACE FUNCTION public.delete_exam(exam_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_exam_owner UUID;
  v_is_admin BOOLEAN;
  v_deleted_count INTEGER := 0;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Check if user is admin
  v_is_admin := public.is_admin();
  
  -- Get exam owner
  SELECT created_by INTO v_exam_owner
  FROM public.exams
  WHERE id = exam_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;
  
  -- Check authorization (must be owner or admin)
  IF v_exam_owner != v_user_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Not authorized to delete this exam';
  END IF;
  
  -- Delete the exam (CASCADE will handle related records)
  DELETE FROM public.exams WHERE id = exam_id_param;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION 'Failed to delete exam';
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'exam_id', exam_id_param,
    'message', 'Exam and all related data deleted successfully'
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_exam(UUID) TO authenticated;

-- ====================================
-- PART 7: Create RPC function for MCQ auto-grading
-- ====================================

CREATE OR REPLACE FUNCTION public.auto_grade_mcq(attempt_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_exam_id UUID;
  v_student_id UUID;
  v_exam_owner UUID;
  v_is_teacher BOOLEAN;
  v_is_admin BOOLEAN;
  v_question RECORD;
  v_student_answer TEXT;
  v_selected_option_id UUID;
  v_is_correct BOOLEAN;
  v_score NUMERIC(10,2);
  v_graded_count INTEGER := 0;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  v_is_teacher := public.is_teacher();
  v_is_admin := public.is_admin();
  
  -- Get attempt details
  SELECT exam_id, student_id INTO v_exam_id, v_student_id
  FROM public.exam_attempts
  WHERE id = attempt_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam attempt not found';
  END IF;
  
  -- Get exam owner
  SELECT created_by INTO v_exam_owner
  FROM public.exams
  WHERE id = v_exam_id;
  
  -- Check authorization (must be exam owner or admin/teacher)
  IF v_exam_owner != v_user_id AND NOT v_is_teacher AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Not authorized to grade this exam';
  END IF;
  
  -- Loop through all MCQ questions in the exam
  FOR v_question IN
    SELECT 
      q.id as question_id,
      q.points,
      q.correct_option_id,
      q.question_type,
      ea.answers
    FROM public.exam_questions eq
    JOIN public.questions q ON q.id = eq.question_id
    JOIN public.exam_attempts ea ON ea.id = attempt_id_param AND ea.exam_id = eq.exam_id
    WHERE eq.exam_id = v_exam_id
      AND q.question_type = 'mcq'
      AND q.correct_option_id IS NOT NULL
    ORDER BY eq.order_number
  LOOP
    -- Get student's answer for this question
    v_student_answer := v_question.answers->>v_question.question_id::text;
    
    IF v_student_answer IS NULL OR v_student_answer = '' THEN
      -- No answer provided
      v_is_correct := false;
      v_score := 0;
      v_selected_option_id := NULL;
    ELSE
      -- Try to parse as UUID (if it's an option_id)
      BEGIN
        v_selected_option_id := v_student_answer::UUID;
      EXCEPTION WHEN OTHERS THEN
        v_selected_option_id := NULL;
      END;
      
      -- Check if answer is correct
      IF v_selected_option_id IS NOT NULL AND v_selected_option_id = v_question.correct_option_id THEN
        v_is_correct := true;
        v_score := v_question.points;
      ELSE
        v_is_correct := false;
        v_score := 0;
      END IF;
    END IF;
    
    -- Insert or update grade
    INSERT INTO public.grades (
      attempt_id,
      question_id,
      score,
      max_score,
      is_correct,
      selected_option_id,
      grader_id,
      graded_at
    ) VALUES (
      attempt_id_param,
      v_question.question_id,
      v_score,
      v_question.points,
      v_is_correct,
      v_selected_option_id,
      v_user_id,
      NOW()
    )
    ON CONFLICT (attempt_id, question_id)
    DO UPDATE SET
      score = EXCLUDED.score,
      is_correct = EXCLUDED.is_correct,
      selected_option_id = EXCLUDED.selected_option_id,
      grader_id = EXCLUDED.grader_id,
      graded_at = EXCLUDED.graded_at;
    
    v_graded_count := v_graded_count + 1;
  END LOOP;
  
  -- Trigger will automatically recalculate total_score and update status
  
  RETURN json_build_object(
    'success', true,
    'attempt_id', attempt_id_param,
    'graded_count', v_graded_count,
    'message', format('Auto-graded %s MCQ questions', v_graded_count)
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.auto_grade_mcq(UUID) TO authenticated;

-- ====================================
-- PART 8: Create trigger to auto-create exam_attempts
-- ====================================

-- Function to ensure exam_attempt exists when needed
CREATE OR REPLACE FUNCTION public.ensure_exam_attempt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a submission is inserted, ensure exam_attempt exists
  INSERT INTO public.exam_attempts (
    id,
    exam_id,
    student_id,
    status,
    answers,
    submitted_at,
    started_at,
    time_taken
  ) VALUES (
    NEW.id,
    NEW.exam_id,
    NEW.student_id,
    'submitted',
    NEW.answers,
    NEW.submitted_at,
    NEW.submitted_at,
    NEW.time_taken
  )
  ON CONFLICT (exam_id, student_id) 
  DO UPDATE SET
    answers = EXCLUDED.answers,
    submitted_at = EXCLUDED.submitted_at,
    time_taken = EXCLUDED.time_taken,
    status = CASE 
      WHEN public.exam_attempts.status = 'draft' THEN 'submitted'::attempt_status
      ELSE public.exam_attempts.status
    END;
  
  RETURN NEW;
END;
$$;

-- Create trigger on submissions table (for backward compatibility)
DROP TRIGGER IF EXISTS ensure_exam_attempt_on_submission ON public.submissions;
CREATE TRIGGER ensure_exam_attempt_on_submission
  AFTER INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_exam_attempt();

-- ====================================
-- PART 9: Backfill and cleanup
-- ====================================

-- Backfill is_correct for existing grades where we can determine it
UPDATE public.grades g
SET is_correct = (g.score = g.max_score)
WHERE g.is_correct IS NULL
  AND EXISTS (
    SELECT 1 FROM public.exam_attempts ea
    JOIN public.questions q ON q.id = g.question_id
    WHERE ea.id = g.attempt_id
      AND q.question_type = 'mcq'
  );

-- Ensure all submitted exam_attempts have the correct status
UPDATE public.exam_attempts
SET status = 'submitted'
WHERE submitted_at IS NOT NULL
  AND status = 'draft';

-- ====================================
-- PART 10: Comments for documentation
-- ====================================

COMMENT ON FUNCTION public.delete_exam(UUID) IS 'Safely deletes an exam and all related data (questions, attempts, grades) with authorization check';
COMMENT ON FUNCTION public.auto_grade_mcq(UUID) IS 'Automatically grades all MCQ questions in an exam attempt by comparing selected options with correct options';
COMMENT ON TABLE public.options IS 'Stores individual options for MCQ questions with proper referential integrity';
COMMENT ON COLUMN public.questions.correct_option_id IS 'Reference to the correct option for MCQ questions';
COMMENT ON COLUMN public.grades.is_correct IS 'Boolean indicating if the answer was correct (for MCQ auto-grading)';
COMMENT ON COLUMN public.grades.selected_option_id IS 'The option selected by the student for MCQ questions';
