-- Hotfix Migration: Fix NULL handling in refresh_student_stats
-- This fixes the error when deleting exams with exam_attempts that trigger stats refresh

-- ====================================
-- Fix refresh_student_stats to handle NULL student_id
-- ====================================

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
  -- Exit early if student_id is NULL (can happen during cascading deletes)
  IF p_student_id IS NULL THEN
    RETURN;
  END IF;
  
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

-- ====================================
-- Also fix the trigger to not call refresh on DELETE
-- ====================================

CREATE OR REPLACE FUNCTION public.exam_attempts_stats_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only refresh stats for INSERT and UPDATE, not DELETE
  -- DELETE operations during cascade shouldn't trigger stats refresh
  IF TG_OP = 'DELETE' THEN
    -- For deletes, check if student_id is not NULL before attempting refresh
    IF OLD.student_id IS NOT NULL THEN
      PERFORM public.refresh_student_stats(OLD.student_id);
    END IF;
  ELSE
    -- For INSERT and UPDATE, use NEW record
    IF NEW.student_id IS NOT NULL THEN
      PERFORM public.refresh_student_stats(NEW.student_id);
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS exam_attempts_after_change ON public.exam_attempts;
CREATE TRIGGER exam_attempts_after_change
  AFTER INSERT OR UPDATE OR DELETE ON public.exam_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.exam_attempts_stats_trigger();

COMMENT ON FUNCTION public.refresh_student_stats(UUID) IS 'Recalculates aggregated statistics for a student - now handles NULL student_id gracefully';
COMMENT ON FUNCTION public.exam_attempts_stats_trigger() IS 'Trigger function that refreshes student stats after exam_attempts changes - with NULL handling for cascading deletes';
