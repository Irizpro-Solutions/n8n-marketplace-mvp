# Payment Error Fix Guide

**Issue:** "Failed to create user profile" when new users try to make payments
**Root Cause:** Missing auth trigger for automatic profile creation during signup

---

## Problem Analysis

### What's Happening?

1. **Old Users (e.g., shivam@irizpro.com):** ✅ Work fine
   - Have existing profiles in database
   - Payment flow works correctly

2. **New Users:** ❌ Fail with "Failed to create user profile"
   - Sign up successfully with Supabase Auth
   - But NO profile created in `profiles` table
   - Payment flow tries to create profile but fails

### Why?

**Missing Database Trigger:**
- Supabase Auth creates user in `auth.users` table
- But does NOT automatically create row in `public.profiles` table
- Need a trigger to sync: `auth.users` → `public.profiles`

---

## Solution

### Fix #1: Add Auth Trigger (Required)

This trigger automatically creates a profile when a user signs up.

**Migration File Created:** `supabase/migrations/20260130_add_auth_profile_trigger.sql`

#### Apply Migration

**Option A: Using Supabase CLI (Recommended)**

```bash
# Login to Supabase (if not already)
npx supabase login

# Link to your project
npx supabase link --project-ref YOUR_PROJECT_REF

# Push migration
npx supabase db push
```

**Option B: Using Supabase Dashboard**

1. Go to: https://app.supabase.com
2. Select your project
3. Go to **SQL Editor**
4. Click **"New Query"**
5. Copy-paste the entire content of `supabase/migrations/20260130_add_auth_profile_trigger.sql`
6. Click **"Run"**
7. Check for success message

**Option C: Using Direct SQL**

If you have direct database access:

```bash
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" -f supabase/migrations/20260130_add_auth_profile_trigger.sql
```

---

### Fix #2: Updated Create-Order Code (Already Applied)

Added fallback profile creation with all required fields:
- ✅ Added `role` field
- ✅ Added `created_at` timestamp
- ✅ Added `updated_at` timestamp
- ✅ Better error logging

**File:** `src/app/api/razorpay/create-order/route.ts`

---

## Testing

### Step 1: Apply Migration

Apply the migration using one of the methods above.

### Step 2: Test with Existing User

1. Login as: `shivam@irizpro.com`
2. Go to: `/browse`
3. Select an agent
4. Click **"Purchase"**
5. **Expected:** Razorpay payment page opens ✅

### Step 3: Test with New User

1. **Sign up** a brand new user (e.g., `test@example.com`)
2. **Verify email** (check inbox or use Supabase dashboard to confirm)
3. **Login** with the new account
4. Go to: `/browse`
5. Select an agent
6. Click **"Purchase"**
7. **Expected:** Razorpay payment page opens ✅

### Step 4: Verify Profile Creation

**Check Database:**

```sql
-- Should see profile created automatically
SELECT id, email, full_name, credits, role, created_at
FROM profiles
WHERE email = 'test@example.com';
```

**Expected Result:**
```
id                  | email              | full_name | credits | role | created_at
--------------------|--------------------|-----------|---------
| ------|------------
88d6dff3-7972-...  | test@example.com   | test      | 0       | user | 2026-01-30 ...
```

---

## Verification Checklist

### Before Migration:
- [ ] New user signup works
- [ ] New user email verification works
- [ ] New user login works
- [ ] **New user payment FAILS** with "Failed to create user profile"
- [ ] Existing user payment works fine

### After Migration:
- [ ] New user signup still works
- [ ] **Profile automatically created** on signup
- [ ] New user can see their email in profile
- [ ] New user payment works (Razorpay opens)
- [ ] Existing user payment still works

---

## How the Fix Works

### Before (Broken):

```
User Signs Up
     ↓
Supabase Auth creates user in auth.users
     ↓
❌ NO TRIGGER → No profile created
     ↓
User tries to pay
     ↓
create-order checks for profile
     ↓
Profile not found
     ↓
Tries to create profile manually
     ↓
❌ FAILS (missing fields or constraint)
     ↓
Error: "Failed to create user profile"
```

### After (Fixed):

```
User Signs Up
     ↓
Supabase Auth creates user in auth.users
     ↓
✅ TRIGGER FIRES → handle_new_user()
     ↓
✅ Profile created in public.profiles
     ↓
User tries to pay
     ↓
create-order checks for profile
     ↓
✅ Profile exists
     ↓
Creates Razorpay order
     ↓
✅ Payment page opens
```

---

## Troubleshooting

### Issue: Migration fails to apply

**Error:** `relation "auth.users" does not exist`

**Fix:**
- You need access to `auth` schema
- Use service_role key or admin access
- Apply via Supabase Dashboard SQL Editor

---

### Issue: Still getting "Failed to create user profile"

**Debug Steps:**

1. **Check trigger exists:**
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
   ```
   Should return 1 row.

2. **Check function exists:**
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'handle_new_user';
   ```
   Should return 1 row.

3. **Test trigger manually:**
   ```sql
   -- This should create a profile
   INSERT INTO auth.users (email, encrypted_password, ...)
   VALUES (...);

   -- Check if profile was created
   SELECT * FROM profiles WHERE email = '...';
   ```

4. **Check server logs:**
   - Restart dev server: `npm run dev`
   - Try payment again
   - Check terminal for error details

---

### Issue: Profile created but payment still fails

**Possible Causes:**

1. **RLS Policy Issue:**
   ```sql
   -- Check RLS policies on profiles
   SELECT * FROM pg_policies WHERE tablename = 'profiles';
   ```

2. **Missing Razorpay Config:**
   ```bash
   # Check .env.local has:
   RAZORPAY_KEY_ID=rzp_...
   RAZORPAY_KEY_SECRET=...
   NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_...
   ```

3. **Check Browser Console:**
   - Open DevTools (F12)
   - Look for detailed error message
   - Should show: `"Failed to create user profile: [actual postgres error]"`

---

## Additional Notes

### Why This Happened

During database migrations (Jan 21-30, 2026), multiple schema changes were made:
- Added `role` column to profiles
- Added credential tables
- Added audit logs
- But **forgot to add auth trigger**

Old users still worked because:
- Their profiles were created before migrations
- Or created manually during testing

New users failed because:
- No automatic profile creation
- Manual fallback in create-order had missing fields

### Prevention

**For Future:**
1. Always include auth triggers in initial setup
2. Test with brand new users, not just existing accounts
3. Check database for orphaned auth users without profiles:
   ```sql
   SELECT au.id, au.email
   FROM auth.users au
   LEFT JOIN public.profiles p ON au.id = p.id
   WHERE p.id IS NULL;
   ```

---

## Summary

**What Changed:**
1. ✅ Created auth trigger migration
2. ✅ Updated create-order with all required fields
3. ✅ Added better error logging

**Action Required:**
1. Apply migration (via Supabase CLI or Dashboard)
2. Test with new user signup
3. Verify payment flow works

**Expected Result:**
- New users automatically get profiles on signup
- Payment flow works for all users (new and existing)
- No more "Failed to create user profile" errors

---

**Ready to fix!** Apply the migration and test with a new user account.
