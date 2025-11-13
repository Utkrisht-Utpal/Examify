-- Migration: Backfill user_roles for existing users
-- This ensures all existing users have entries in user_roles table

-- Insert student roles for all users who have submitted exams but don't have a role yet
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT s.student_id, 'student'::app_role
FROM public.submissions s
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = s.student_id
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Also check exam_attempts table (new structure)
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT ea.student_id, 'student'::app_role
FROM public.exam_attempts ea
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = ea.student_id
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Insert teacher roles for all users who have created exams but don't have a role yet
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT e.created_by, 'teacher'::app_role
FROM public.exams e
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = e.created_by
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Insert student roles for users in profiles who aren't teachers (fallback)
-- This catches any users who signed up but haven't taken action yet
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'student'::app_role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = p.id
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Log the results
DO $$
DECLARE
  student_count INTEGER;
  teacher_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO student_count FROM public.user_roles WHERE role = 'student';
  SELECT COUNT(*) INTO teacher_count FROM public.user_roles WHERE role = 'teacher';
  
  RAISE NOTICE 'Backfill complete: % students, % teachers', student_count, teacher_count;
END $$;
