-- Allow students to view questions that are part of published exams
CREATE POLICY "Students can view questions in published exams"
ON questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exam_questions eq
    JOIN exams e ON eq.exam_id = e.id
    WHERE eq.question_id = questions.id
    AND e.status = 'published'
    AND is_student()
  )
);