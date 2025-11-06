-- Add fields for exam scheduling and auto-close functionality
ALTER TABLE exams 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_close BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_timed BOOLEAN DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN exams.start_time IS 'When the exam becomes available to students';
COMMENT ON COLUMN exams.end_time IS 'When the exam automatically closes (optional)';
COMMENT ON COLUMN exams.auto_close IS 'Whether to automatically close exam at end_time';
COMMENT ON COLUMN exams.is_timed IS 'Whether exam has a time limit per student or is open-ended';