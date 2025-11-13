# Student Count Fix - Quick Guide

## Problem
- Teacher dashboard shows "0" students even though students exist
- Existing users don't have entries in `user_roles` table

## Solution

### Step 1: Run the Backfill Migration

**Option A: Automatic (wait for deployment)**
- The migration will run automatically on next deploy
- File: `supabase/migrations/20251113000001_backfill_user_roles.sql`

**Option B: Manual (run now)**
1. Go to Supabase Dashboard → SQL Editor
2. Copy the contents of `supabase/migrations/20251113000001_backfill_user_roles.sql`
3. Paste and click **Run**
4. You should see: "Backfill complete: X students, Y teachers"

### Step 2: Verify the Fix

Run this query in Supabase SQL Editor:
```sql
-- Check user_roles populated
SELECT role, COUNT(*) as count 
FROM user_roles 
GROUP BY role;

-- Should show something like:
-- student | 5
-- teacher | 2
```

### Step 3: Check Dashboard

1. Refresh your teacher dashboard
2. The "Total Students" card should now show the correct count
3. Count will auto-update when new students sign up (realtime)

---

## What the Migration Does

1. **Finds all students** who submitted exams but don't have a `user_roles` entry
2. **Finds all teachers** who created exams but don't have a `user_roles` entry
3. **Adds student role** to all remaining users in `profiles` table
4. **No duplicates** - uses `ON CONFLICT DO NOTHING`

---

## What the Code Fix Does

The updated `TeacherDashboard.tsx` now:
1. **First tries** `user_roles` table (correct source)
2. **Falls back** to counting unique students from `exam_attempts`
3. **Final fallback** counts from `submissions` table
4. **Real-time updates** when new students submit exams

---

## Testing

After running the migration:

```sql
-- Test 1: Count should match
SELECT 
  (SELECT COUNT(*) FROM user_roles WHERE role = 'student') as roles_count,
  (SELECT COUNT(DISTINCT student_id) FROM exam_attempts) as attempts_count,
  (SELECT COUNT(DISTINCT student_id) FROM submissions) as submissions_count;
```

All three should be similar (roles_count might be higher if some users never submitted).

---

## Files Changed

1. ✅ `supabase/migrations/20251113000001_backfill_user_roles.sql` (NEW)
2. ✅ `src/components/dashboard/TeacherDashboard.tsx` (UPDATED)

---

## Next Steps

1. **Commit these changes** to git
2. **Push to GitHub** 
3. **Deploy** (Vercel auto-deploys)
4. **OR run migration manually** in Supabase now (see Option B above)

---

## Expected Result

**Before:**
```
Total Students: 0
```

**After:**
```
Total Students: 5  (or whatever your actual count is)
```

The count will now:
- ✅ Show correct number immediately
- ✅ Update in real-time when students sign up
- ✅ Work even if user_roles is empty (fallback logic)
