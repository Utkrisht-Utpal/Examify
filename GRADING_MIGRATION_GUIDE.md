# Grading and Robustness Migration Guide

## Overview

This migration introduces comprehensive improvements to the grading system, including:

1. **Fixed teacher grading bug** where entering a numeric grade immediately became zero
2. **Immutable student submissions** after submit with proper status tracking
3. **Robust average calculations** for students and teacher dashboards
4. **Separate graded vs pending attempts** with correct views and RLS policies
5. **Database triggers** for atomic grade writing and stats maintenance
6. **Realtime subscriptions** for immediate dashboard updates

## Database Schema Changes

### New Tables

#### 1. `exam_attempts`
Replaces `submissions` with enhanced tracking:
- `status`: ENUM('draft', 'submitted', 'in_review', 'graded', 'closed')
- `version`: Optimistic locking for concurrent updates
- `total_score`: Automatically calculated from grades
- `graded_at`: Timestamp when fully graded
- Constraint: Answers immutable after status changes from 'draft'

#### 2. `grades`
Per-question grading with validation:
- `attempt_id`: Foreign key to exam_attempts
- `question_id`: Foreign key to questions
- `score`: Validated to be within [0, max_score]
- `max_score`: Must be positive
- `grader_id`: Teacher who graded
- `feedback`: Optional per-question feedback
- Unique constraint on (attempt_id, question_id)

#### 3. `student_stats`
Aggregated statistics, automatically maintained:
- `total_attempts`: Count of submitted/graded attempts
- `graded_attempts`: Count of fully graded attempts
- `average_score`: Average score across graded attempts
- `average_percentage`: Average percentage across graded attempts
- `last_attempt_at`: Timestamp of most recent attempt

### New Functions

#### `recalculate_attempt_score()`
Trigger function that automatically:
- Sums all grade scores for an attempt
- Updates `exam_attempts.total_score`
- Changes status to 'in_review' when partially graded
- Changes status to 'graded' when all questions graded
- Calls `refresh_student_stats()` for the student

#### `refresh_student_stats(p_student_id UUID)`
Recalculates and updates all statistics for a student:
- Counts total and graded attempts
- Calculates average score and percentage
- Updates last_attempt_at timestamp
- Uses UPSERT for idempotency

### Triggers

1. **grades_after_change**: After INSERT/UPDATE/DELETE on `grades` → calls `recalculate_attempt_score()`
2. **exam_attempts_after_change**: After INSERT/UPDATE/DELETE on `exam_attempts` → calls `refresh_student_stats()`

### RLS Policies

#### exam_attempts
- Students: Can view/create/update own draft attempts; can submit by changing status to 'submitted'
- Teachers: Can view/update attempts for exams they created (for status changes during grading)

#### grades
- Students: Can view own grades only when attempt.status = 'graded'
- Teachers: Full CRUD on grades for their exam attempts

#### student_stats
- Students: Can view own stats
- Teachers: Can view stats for students who took their exams

## Frontend Changes

### 1. GradingInterface Component
**File**: `src/components/grading/GradingInterface.tsx`

**Changes**:
- Input fields now accept empty strings while typing
- Only convert to number when saving (onBlur or Save button)
- Validation ensures score >= 0 and score <= max_score
- Passes per-question grades to mutation

**Impact**: Fixes the bug where grades immediately reset to 0

### 2. useGrading Hook
**File**: `src/hooks/useGrading.tsx`

**Changes**:
- `gradeSubmission` mutation now accepts `questionGrades` parameter
- Inserts/updates `grades` table using upsert
- Maintains backward compatibility with `results` table
- Triggers automatically update `exam_attempts.total_score`

### 3. useSubmissions Hook
**File**: `src/hooks/useSubmissions.tsx`

**Changes**:
- Checks `exam_attempts` table for existing submissions
- Prevents resubmission if status != 'draft'
- Creates/updates `exam_attempts` instead of `submissions`
- Syncs with `submissions` table for backward compatibility

### 4. Dashboard Realtime Updates

**Files**: 
- `src/hooks/useResults.tsx`
- `src/components/dashboard/TeacherDashboard.tsx`

**Changes**:
- Added Supabase Realtime subscriptions to `results`, `grades`, and `exam_attempts` tables
- Dashboards automatically refresh when grades are saved
- No manual refresh needed

## Migration Process

### Prerequisites
- Supabase CLI installed (optional for local testing)
- Database backup (recommended)
- Service role key (if applying to production)

### Steps

1. **Create feature branch** (already done):
   ```bash
   git checkout -b fix/grading-and-robustness
   ```

2. **Review migration file**:
   - Located at: `supabase/migrations/20251113000000_grading_robustness_improvements.sql`
   - Review all changes before applying

3. **Apply migration**:

   **Option A: Using Supabase Dashboard**
   - Navigate to SQL Editor in Supabase Dashboard
   - Copy contents of migration file
   - Execute SQL

   **Option B: Using Supabase CLI**
   ```bash
   supabase db push
   ```

   **Option C: Automatic on deploy**
   - Migration will apply automatically when deploying to Supabase

4. **Verify migration**:
   ```sql
   -- Check new tables exist
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('exam_attempts', 'grades', 'student_stats');

   -- Check data migrated
   SELECT COUNT(*) FROM exam_attempts;
   SELECT COUNT(*) FROM student_stats;

   -- Check triggers exist
   SELECT trigger_name FROM information_schema.triggers 
   WHERE trigger_schema = 'public' 
   AND event_object_table IN ('grades', 'exam_attempts');
   ```

5. **Test functionality**:
   - Student submits exam → verify status = 'submitted'
   - Teacher grades questions → verify grades table populated
   - Check total_score updated automatically
   - Verify dashboards show correct averages
   - Test realtime updates

## Testing Scenarios

### Scenario 1: Student Submission
1. Student starts exam (creates draft attempt)
2. Student answers questions
3. Student submits → status changes to 'submitted', answers locked
4. Attempt to resubmit → should fail with error

**Expected**: 
- `exam_attempts` row with status='submitted'
- `submitted_at` timestamp set
- Cannot modify answers after submission

### Scenario 2: Teacher Grading
1. Teacher opens pending submission
2. Teacher enters grade 8/10 for question 1
3. Teacher enters grade 5/5 for question 2
4. Teacher saves

**Expected**:
- 2 rows in `grades` table
- `exam_attempts.total_score` = 13
- `exam_attempts.status` = 'graded' (if all questions graded)
- `student_stats` updated with new average

### Scenario 3: Grade Edit
1. Teacher opens graded submission
2. Teacher changes grade from 8 to 9
3. Teacher saves

**Expected**:
- `grades` row updated
- `exam_attempts.total_score` recalculated to 14
- `student_stats` average recalculated
- Dashboard updates immediately (realtime)

### Scenario 4: Dashboard Averages
1. Multiple students submit exams
2. Teacher grades all submissions
3. Check teacher dashboard

**Expected**:
- Average score calculated correctly
- Only graded attempts counted
- Realtime updates as grades saved

## Rollback Plan

If issues occur, you can rollback by:

1. **Restore from backup** (safest option)

2. **Drop new tables** (data loss):
   ```sql
   DROP TABLE IF EXISTS public.grades CASCADE;
   DROP TABLE IF EXISTS public.exam_attempts CASCADE;
   DROP TABLE IF EXISTS public.student_stats CASCADE;
   DROP TYPE IF EXISTS public.attempt_status CASCADE;
   ```

3. **Revert code changes**:
   ```bash
   git revert <commit-hash>
   ```

## Performance Considerations

### Indexes Added
- `idx_exam_attempts_student_id`
- `idx_exam_attempts_exam_id`
- `idx_exam_attempts_status`
- `idx_grades_attempt_id`
- `idx_grades_question_id`
- `idx_student_stats_student_id`

### Query Optimization
- Triggers use indexed lookups
- Student stats cached in dedicated table
- RLS policies optimized with EXISTS clauses

### Expected Performance
- Grade save: < 100ms (includes trigger execution)
- Dashboard load: < 200ms (uses indexed stats)
- Realtime update latency: < 500ms

## Troubleshooting

### Issue: Migration fails with "duplicate key value"
**Solution**: Existing data conflicts. Check for duplicate submissions:
```sql
SELECT exam_id, student_id, COUNT(*) 
FROM submissions 
GROUP BY exam_id, student_id 
HAVING COUNT(*) > 1;
```

### Issue: Grades not updating total_score
**Solution**: Check trigger exists and is enabled:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'grades_after_change';
```

### Issue: Students can still resubmit
**Solution**: Verify RLS policy on exam_attempts:
```sql
SELECT * FROM pg_policies WHERE tablename = 'exam_attempts';
```

### Issue: Dashboards not updating in realtime
**Solution**: Check Realtime is enabled for tables in Supabase Dashboard:
- Database → Replication → Enable for `grades`, `exam_attempts`

## Security Considerations

### Data Access
- Students can only view their own attempts and grades
- Teachers can only grade attempts for their exams
- Grades only visible to students when fully graded

### Input Validation
- Scores validated at database level (CHECK constraints)
- Status transitions restricted by RLS policies
- Version column for optimistic locking

### Audit Trail
- All grades include `grader_id` and `graded_at`
- Attempt status changes tracked
- Timestamps on all modifications

## Backward Compatibility

### Maintained Tables
- `submissions` table still populated for backward compatibility
- `results` table still used alongside `grades`
- Existing queries continue to work

### Breaking Changes
- None. All changes are additive or backward compatible.

## Support

For issues or questions:
1. Check this guide first
2. Review migration SQL comments
3. Check Supabase logs in Dashboard
4. Create GitHub issue with details

## Changelog

### Version 1.0 (2025-11-13)
- Initial migration
- Added exam_attempts, grades, student_stats tables
- Fixed grading zero bug
- Added realtime subscriptions
- Implemented immutable submissions
- Added automatic stats calculation
