-- Fix RLS policies for students to view questions in published exams

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Students can view questions in published exams" ON public.questions;
DROP POLICY IF EXISTS "Students can view exam questions" ON public.exam_questions;

-- Create new simplified policy for students to view questions
-- This checks if the question exists in exam_questions for a published exam
CREATE POLICY "Students can view questions in published exams"
ON public.questions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.exam_questions eq
    INNER JOIN public.exams e ON e.id = eq.exam_id
    WHERE eq.question_id = questions.id
    AND e.status = 'published'
  )
);

-- Create policy for students to view exam_questions mappings
CREATE POLICY "Students can view exam questions for published exams"
ON public.exam_questions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.exams e
    WHERE e.id = exam_questions.exam_id
    AND e.status = 'published'
  )
);