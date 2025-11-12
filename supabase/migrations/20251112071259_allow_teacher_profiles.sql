-- Allow teachers to view student profiles for their own exams so names show on dashboards and grading
-- Safe and scoped: only teachers/admins, and only for students who submitted to the teacher's exams

DO $$ BEGIN
  -- Drop existing policy if a conflicting one exists (optional safeguard)
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Teachers can view profiles for own exams'
  ) THEN
    EXECUTE 'DROP POLICY "Teachers can view profiles for own exams" ON public.profiles';
  END IF;
END $$;

CREATE POLICY "Teachers can view profiles for own exams"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (is_teacher() OR is_admin()) AND EXISTS (
    SELECT 1
    FROM public.submissions s
    JOIN public.exams e ON e.id = s.exam_id
    WHERE s.student_id = profiles.id
      AND e.created_by = auth.uid()
  )
);
