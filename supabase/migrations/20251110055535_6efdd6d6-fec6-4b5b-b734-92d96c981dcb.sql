-- Fix the student questions RLS policy to work properly with direct ID queries
-- The current policy requires a complex join that doesn't work well with .in() queries

-- Drop the problematic policy
DROP POLICY IF EXISTS "Students can view questions in published exams without answers" ON questions;

-- Create a simpler, more efficient policy
-- Students can view questions if they're linked to any published exam
CREATE POLICY "Students can view questions in published exams"
ON questions
FOR SELECT
TO authenticated
USING (
  is_student() AND 
  EXISTS (
    SELECT 1 
    FROM exam_questions eq
    INNER JOIN exams e ON eq.exam_id = e.id
    WHERE eq.question_id = questions.id 
      AND e.status = 'published'
  )
);

-- Ensure the exam_questions table has proper RLS for students
DROP POLICY IF EXISTS "Students can view exam questions" ON exam_questions;

CREATE POLICY "Students can view exam questions"
ON exam_questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exams
    WHERE exams.id = exam_questions.exam_id
      AND exams.status = 'published'
  )
);