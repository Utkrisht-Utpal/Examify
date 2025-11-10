-- Allow students to insert their own results when submitting exams
CREATE POLICY "Students can create own results"
ON public.results
FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

-- Add a unique constraint to prevent duplicate submissions (if not exists)
-- This constraint likely already exists based on the error message
-- ALTER TABLE public.submissions 
-- ADD CONSTRAINT submissions_exam_id_student_id_key UNIQUE (exam_id, student_id);