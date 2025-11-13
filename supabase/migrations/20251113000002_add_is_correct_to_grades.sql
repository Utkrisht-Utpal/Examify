-- Add is_correct flag to grades table for explicit correct/incorrect marking

ALTER TABLE public.grades
ADD COLUMN IF NOT EXISTS is_correct BOOLEAN DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.grades.is_correct IS 'Explicit marking by teacher: true=correct, false=incorrect, null=partial/ungraded';

-- Update existing grades based on score
-- Full marks = correct, zero = incorrect, partial = null
UPDATE public.grades
SET is_correct = CASE
  WHEN score = max_score THEN true
  WHEN score = 0 THEN false
  ELSE NULL
END
WHERE is_correct IS NULL;
