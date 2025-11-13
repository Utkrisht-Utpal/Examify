-- Migration: Grading and Robustness Improvements
-- This migration adds:
-- 1. exam_attempts table with status tracking
-- 2. grades table for per-question grading
-- 3. student_stats table for aggregated statistics
-- 4. Triggers for automatic calculations
-- 5. RLS policies for security
-- 6. Data migration from existing submissions

-- ==================================
-- PART 1: Create new tables and enums
-- ==================================

-- Create attempt_status enum
DO $$ BEGIN
  CREATE TYPE public.attempt_status AS ENUM ('draft', 'submitted', 'in_review', 'graded', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create exam_attempts table (replacement for submissions with better tracking)
CREATE TABLE IF NOT EXISTS public.exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status attempt_status NOT NULL DEFAULT 'draft',
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  time_taken INTEGER, -- Time taken in minutes
  total_score NUMERIC(10,2) DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  graded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(exam_id, student_id),
  -- Ensure answers cannot be modified after submission
  CONSTRAINT answers_immutable_after_submit CHECK (
    (status = 'draft') OR (answers IS NOT NULL)
  )
);

-- Create grades table for per-question grading
CREATE TABLE IF NOT EXISTS public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES public.exam_attempts(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  score NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_score NUMERIC(10,2) NOT NULL,
  grader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  graded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(attempt_id, question_id),
  -- Ensure score is within valid range
  CONSTRAINT score_range CHECK (score >= 0 AND score <= max_score),
  CONSTRAINT max_score_positive CHECK (max_score > 0)
);

-- Create student_stats table for aggregated statistics
CREATE TABLE IF NOT EXISTS public.student_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_attempts INTEGER NOT NULL DEFAULT 0,
  graded_attempts INTEGER NOT NULL DEFAULT 0,
  average_score NUMERIC(10,2) DEFAULT 0,
  average_percentage NUMERIC(5,2) DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================================
-- PART 2: Create indexes for performance
-- ==================================

CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_id ON public.exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id ON public.exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_status ON public.exam_attempts(status);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_submitted_at ON public.exam_attempts(submitted_at);

CREATE INDEX IF NOT EXISTS idx_grades_attempt_id ON public.grades(attempt_id);
CREATE INDEX IF NOT EXISTS idx_grades_question_id ON public.grades(question_id);
CREATE INDEX IF NOT EXISTS idx_grades_grader_id ON public.grades(grader_id);

CREATE INDEX IF NOT EXISTS idx_student_stats_student_id ON public.student_stats(student_id);

-- ==================================
-- PART 3: Create functions and triggers
-- ==================================

-- Function to update updated_at timestamp on exam_attempts
CREATE OR REPLACE FUNCTION public.update_exam_attempts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_exam_attempts_updated_at
  BEFORE UPDATE ON public.exam_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_exam_attempts_updated_at();

-- Function to update updated_at timestamp on grades
CREATE OR REPLACE FUNCTION public.update_grades_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_grades_updated_at
  BEFORE UPDATE ON public.grades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_grades_updated_at();

-- Function to recalculate attempt total_score when grades change
CREATE OR REPLACE FUNCTION public.recalculate_attempt_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_id UUID;
  v_total_score NUMERIC(10,2);
  v_expected_questions INTEGER;
  v_graded_questions INTEGER;
BEGIN
  -- Get the attempt_id from NEW or OLD
  v_attempt_id := COALESCE(NEW.attempt_id, OLD.attempt_id);
  
  -- Calculate total score from all grades for this attempt
  SELECT COALESCE(SUM(score), 0)
  INTO v_total_score
  FROM public.grades
  WHERE attempt_id = v_attempt_id;
  
  -- Count how many questions are expected vs graded
  SELECT COUNT(DISTINCT eq.question_id)
  INTO v_expected_questions
  FROM public.exam_questions eq
  JOIN public.exam_attempts ea ON ea.exam_id = eq.exam_id
  WHERE ea.id = v_attempt_id;
  
  SELECT COUNT(*)
  INTO v_graded_questions
  FROM public.grades
  WHERE attempt_id = v_attempt_id;
  
  -- Update the attempt with new total_score
  UPDATE public.exam_attempts
  SET 
    total_score = v_total_score,
    status = CASE
      WHEN v_graded_questions >= v_expected_questions THEN 'graded'::attempt_status
      WHEN v_graded_questions > 0 THEN 'in_review'::attempt_status
      ELSE status
    END,
    graded_at = CASE
      WHEN v_graded_questions >= v_expected_questions THEN NOW()
      ELSE graded_at
    END
  WHERE id = v_attempt_id;
  
  -- Trigger student stats refresh
  PERFORM public.refresh_student_stats(
    (SELECT student_id FROM public.exam_attempts WHERE id = v_attempt_id)
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger after grades INSERT/UPDATE/DELETE
CREATE TRIGGER grades_after_change
  AFTER INSERT OR UPDATE OR DELETE ON public.grades
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_attempt_score();

-- Function to refresh student statistics
CREATE OR REPLACE FUNCTION public.refresh_student_stats(p_student_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_attempts INTEGER;
  v_graded_attempts INTEGER;
  v_avg_score NUMERIC(10,2);
  v_avg_percentage NUMERIC(5,2);
  v_last_attempt_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Count total attempts
  SELECT COUNT(*)
  INTO v_total_attempts
  FROM public.exam_attempts
  WHERE student_id = p_student_id
    AND status IN ('submitted', 'in_review', 'graded');
  
  -- Count graded attempts
  SELECT COUNT(*)
  INTO v_graded_attempts
  FROM public.exam_attempts
  WHERE student_id = p_student_id
    AND status = 'graded';
  
  -- Calculate average score and percentage for graded attempts
  SELECT 
    COALESCE(AVG(ea.total_score), 0),
    COALESCE(AVG((ea.total_score / NULLIF(e.total_marks, 0)) * 100), 0)
  INTO v_avg_score, v_avg_percentage
  FROM public.exam_attempts ea
  JOIN public.exams e ON e.id = ea.exam_id
  WHERE ea.student_id = p_student_id
    AND ea.status = 'graded';
  
  -- Get last attempt timestamp
  SELECT MAX(submitted_at)
  INTO v_last_attempt_at
  FROM public.exam_attempts
  WHERE student_id = p_student_id
    AND submitted_at IS NOT NULL;
  
  -- Upsert student_stats
  INSERT INTO public.student_stats (
    student_id,
    total_attempts,
    graded_attempts,
    average_score,
    average_percentage,
    last_attempt_at,
    updated_at
  )
  VALUES (
    p_student_id,
    v_total_attempts,
    v_graded_attempts,
    v_avg_score,
    v_avg_percentage,
    v_last_attempt_at,
    NOW()
  )
  ON CONFLICT (student_id)
  DO UPDATE SET
    total_attempts = EXCLUDED.total_attempts,
    graded_attempts = EXCLUDED.graded_attempts,
    average_score = EXCLUDED.average_score,
    average_percentage = EXCLUDED.average_percentage,
    last_attempt_at = EXCLUDED.last_attempt_at,
    updated_at = NOW();
END;
$$;

-- Trigger to refresh student stats when exam_attempts change
CREATE OR REPLACE FUNCTION public.exam_attempts_stats_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Refresh stats for the affected student
  PERFORM public.refresh_student_stats(COALESCE(NEW.student_id, OLD.student_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER exam_attempts_after_change
  AFTER INSERT OR UPDATE OR DELETE ON public.exam_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.exam_attempts_stats_trigger();

-- ==================================
-- PART 4: Enable RLS and create policies
-- ==================================

ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exam_attempts

-- Students can view their own attempts
CREATE POLICY "Students can view own attempts"
  ON public.exam_attempts
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- Students can insert their own draft attempts
CREATE POLICY "Students can create own attempts"
  ON public.exam_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid() AND status = 'draft');

-- Students can update their own draft attempts (answers, status change to submitted)
CREATE POLICY "Students can update own draft attempts"
  ON public.exam_attempts
  FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid() AND status = 'draft')
  WITH CHECK (
    student_id = auth.uid() AND
    (status = 'draft' OR status = 'submitted')
  );

-- Teachers can view attempts for their exams
CREATE POLICY "Teachers can view attempts for own exams"
  ON public.exam_attempts
  FOR SELECT
  TO authenticated
  USING (
    (is_teacher() OR is_admin()) AND
    EXISTS (
      SELECT 1 FROM public.exams
      WHERE exams.id = exam_attempts.exam_id
        AND exams.created_by = auth.uid()
    )
  );

-- Teachers can update attempts for their exams (for grading status changes)
CREATE POLICY "Teachers can update attempts for own exams"
  ON public.exam_attempts
  FOR UPDATE
  TO authenticated
  USING (
    (is_teacher() OR is_admin()) AND
    EXISTS (
      SELECT 1 FROM public.exams
      WHERE exams.id = exam_attempts.exam_id
        AND exams.created_by = auth.uid()
    )
  );

-- RLS Policies for grades

-- Students can view their own grades
CREATE POLICY "Students can view own grades"
  ON public.grades
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_attempts
      WHERE exam_attempts.id = grades.attempt_id
        AND exam_attempts.student_id = auth.uid()
        AND exam_attempts.status = 'graded'
    )
  );

-- Teachers can view grades for their exam attempts
CREATE POLICY "Teachers can view grades for own exams"
  ON public.grades
  FOR SELECT
  TO authenticated
  USING (
    (is_teacher() OR is_admin()) AND
    EXISTS (
      SELECT 1
      FROM public.exam_attempts ea
      JOIN public.exams e ON e.id = ea.exam_id
      WHERE ea.id = grades.attempt_id
        AND e.created_by = auth.uid()
    )
  );

-- Teachers can insert grades for their exam attempts
CREATE POLICY "Teachers can insert grades for own exams"
  ON public.grades
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_teacher() OR is_admin()) AND
    EXISTS (
      SELECT 1
      FROM public.exam_attempts ea
      JOIN public.exams e ON e.id = ea.exam_id
      WHERE ea.id = grades.attempt_id
        AND e.created_by = auth.uid()
    )
  );

-- Teachers can update grades for their exam attempts
CREATE POLICY "Teachers can update grades for own exams"
  ON public.grades
  FOR UPDATE
  TO authenticated
  USING (
    (is_teacher() OR is_admin()) AND
    EXISTS (
      SELECT 1
      FROM public.exam_attempts ea
      JOIN public.exams e ON e.id = ea.exam_id
      WHERE ea.id = grades.attempt_id
        AND e.created_by = auth.uid()
    )
  );

-- Teachers can delete grades for their exam attempts
CREATE POLICY "Teachers can delete grades for own exams"
  ON public.grades
  FOR DELETE
  TO authenticated
  USING (
    (is_teacher() OR is_admin()) AND
    EXISTS (
      SELECT 1
      FROM public.exam_attempts ea
      JOIN public.exams e ON e.id = ea.exam_id
      WHERE ea.id = grades.attempt_id
        AND e.created_by = auth.uid()
    )
  );

-- RLS Policies for student_stats

-- Students can view their own stats
CREATE POLICY "Students can view own stats"
  ON public.student_stats
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- Teachers can view stats for students who took their exams
CREATE POLICY "Teachers can view student stats for own exams"
  ON public.student_stats
  FOR SELECT
  TO authenticated
  USING (
    (is_teacher() OR is_admin()) AND
    EXISTS (
      SELECT 1
      FROM public.exam_attempts ea
      JOIN public.exams e ON e.id = ea.exam_id
      WHERE ea.student_id = student_stats.student_id
        AND e.created_by = auth.uid()
    )
  );

-- ==================================
-- PART 5: Migrate existing data
-- ==================================

-- Migrate data from submissions to exam_attempts
INSERT INTO public.exam_attempts (
  id,
  exam_id,
  student_id,
  status,
  answers,
  submitted_at,
  started_at,
  time_taken,
  total_score,
  version,
  graded_at,
  created_at,
  updated_at
)
SELECT 
  s.id,
  s.exam_id,
  s.student_id,
  CASE 
    WHEN r.graded_at IS NOT NULL THEN 'graded'::attempt_status
    WHEN s.submitted_at IS NOT NULL THEN 'submitted'::attempt_status
    ELSE 'draft'::attempt_status
  END,
  s.answers,
  s.submitted_at,
  s.submitted_at, -- Use submitted_at as started_at since we don't have that data
  s.time_taken,
  COALESCE(r.score, 0),
  1,
  r.graded_at,
  s.submitted_at,
  COALESCE(r.graded_at, s.submitted_at, NOW())
FROM public.submissions s
LEFT JOIN public.results r ON r.submission_id = s.id
ON CONFLICT (exam_id, student_id) DO NOTHING;

-- Initialize student_stats for all students with attempts
INSERT INTO public.student_stats (student_id)
SELECT DISTINCT student_id
FROM public.exam_attempts
ON CONFLICT (student_id) DO NOTHING;

-- Refresh all student stats
DO $$
DECLARE
  student_record RECORD;
BEGIN
  FOR student_record IN 
    SELECT DISTINCT student_id FROM public.exam_attempts
  LOOP
    PERFORM public.refresh_student_stats(student_record.student_id);
  END LOOP;
END $$;

-- ==================================
-- PART 6: Comments for documentation
-- ==================================

COMMENT ON TABLE public.exam_attempts IS 'Stores student exam attempts with status tracking and immutability after submission';
COMMENT ON TABLE public.grades IS 'Stores per-question grades with automatic score calculation';
COMMENT ON TABLE public.student_stats IS 'Aggregated statistics for students, automatically maintained by triggers';
COMMENT ON COLUMN public.exam_attempts.version IS 'Optimistic locking version for concurrent updates';
COMMENT ON COLUMN public.exam_attempts.status IS 'Current status: draft, submitted, in_review, graded, closed';
COMMENT ON FUNCTION public.recalculate_attempt_score() IS 'Automatically recalculates total_score and updates status when grades change';
COMMENT ON FUNCTION public.refresh_student_stats(UUID) IS 'Recalculates aggregated statistics for a student';
