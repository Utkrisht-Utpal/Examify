-- Allow teachers and admins to count students
CREATE POLICY "Teachers can view student count" 
ON public.user_roles 
FOR SELECT 
USING (
  (is_teacher() OR is_admin()) 
  AND role = 'student'
);