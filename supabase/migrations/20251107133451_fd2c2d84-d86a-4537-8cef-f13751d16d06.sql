-- Remove the security definer view and fix properly
DROP VIEW IF EXISTS student_questions;

-- The correct_answer field should simply not be selected in queries for students
-- The RLS policy is sufficient - students can read questions but frontend should
-- filter out correct_answer field when displaying to students