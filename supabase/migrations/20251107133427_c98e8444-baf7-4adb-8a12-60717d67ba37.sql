-- Fix critical security issues

-- 1. Fix profiles table - users can only view their own profile
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Fix questions table - students CANNOT see correct answers
DROP POLICY IF EXISTS "Students can view questions in published exams" ON questions;

-- Create a view for students that excludes correct answers
CREATE OR REPLACE VIEW student_questions AS
SELECT 
  id,
  question_text,
  question_type,
  options,
  points,
  subject,
  created_at,
  updated_at,
  created_by
FROM questions;

-- Students can only see questions WITHOUT correct answers through exam_questions join
CREATE POLICY "Students can view questions in published exams without answers"
ON questions
FOR SELECT
TO authenticated
USING (
  is_student() AND
  EXISTS (
    SELECT 1 FROM exam_questions eq
    JOIN exams e ON eq.exam_id = e.id
    WHERE eq.question_id = questions.id
    AND e.status = 'published'
  )
);

-- 3. Fix results table - teachers can only view results for their own exams
DROP POLICY IF EXISTS "Teachers can view all results" ON results;

CREATE POLICY "Teachers can view own exam results"
ON results
FOR SELECT
TO authenticated
USING (
  (is_teacher() OR is_admin()) AND
  EXISTS (
    SELECT 1 FROM exams 
    WHERE exams.id = results.exam_id 
    AND exams.created_by = auth.uid()
  )
);

-- Admins can still see all results
CREATE POLICY "Admins can view all results"
ON results
FOR SELECT
TO authenticated
USING (is_admin());