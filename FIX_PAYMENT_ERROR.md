# 🔧 Fix Payment Verification Error

## Problem

When users complete payment via Razorpay, the payment succeeds but verification fails with error:

```
❌ Payment verification failed: column "purchased_at" of relation "user_agents" does not exist.
Please contact support with payment ID: pay_XXXXXXXXXX
```

**Root Cause:**
The database RPC function `process_payment_atomic` (line 378 in `20260121_security_improvements.sql`) tries to insert a `purchased_at` column into the `user_agents` table, but that column doesn't exist.

**Affected Payments:**
- `pay_S9HpdwYL3btgPj`
- `pay_S9I03w3CD8IYN8`
- Any other failed verifications

---

## Solution

Run the migration file to add the missing column:

### Step 1: Run the Migration

1. Go to your Supabase Dashboard: https://app.supabase.com/project/YOUR_PROJECT/sql/new

2. Copy and paste the entire contents of this file:
   ```
   supabase/migrations/20260128_fix_user_agents_purchased_at.sql
   ```

3. Click **"RUN"**

4. You should see success messages:
   ```
   ✅ purchased_at column successfully added to user_agents table
   ✅ Backfilled X existing records
   ✅ Payment verification should now work correctly
   🎉 Migration complete!
   ```

### Step 2: Verify the Fix

Run this SQL in Supabase SQL Editor to confirm:

```sql
-- Check if column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_agents' AND column_name = 'purchased_at';

-- Should return:
-- column_name   | data_type                   | column_default
-- purchased_at  | timestamp with time zone    | now()
```

### Step 3: Test Payment Flow

1. **No need to restart your Next.js server** - this is a database change only
2. Go to your app and try purchasing an agent again
3. Complete the Razorpay payment
4. Payment verification should now succeed ✅

---

## What This Migration Does

1. **Adds the missing column:**
   ```sql
   ALTER TABLE user_agents
   ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
   ```

2. **Backfills existing records:**
   - If `user_agents` has a `created_at` column, copies that value
   - Otherwise uses current timestamp

3. **Creates performance index:**
   - Adds index on `purchased_at DESC` for faster queries

4. **Safe to run multiple times:**
   - Uses `IF NOT EXISTS` - won't error if column already exists

---

## For Users Who Already Paid

If you have users whose payments succeeded on Razorpay but failed verification (like payment IDs `pay_S9HpdwYL3btgPj` and `pay_S9I03w3CD8IYN8`), you'll need to manually process those payments after running the migration:

### Option 1: Have Users Pay Again (Recommended)

After running the migration, the payment flow will work correctly for new payments.

### Option 2: Manually Process Failed Payments

You would need to:
1. Look up the payment details in Razorpay dashboard
2. Manually run the `process_payment_atomic` RPC function with the payment details
3. This is more complex and error-prone

**I recommend Option 1** - refunding the failed payments through Razorpay and having users pay again with the fixed system.

---

## Verification Checklist

- [ ] Run the migration SQL in Supabase
- [ ] Verify column exists: `SELECT * FROM information_schema.columns WHERE table_name = 'user_agents' AND column_name = 'purchased_at';`
- [ ] Test a new payment flow end-to-end
- [ ] Verify user sees agent in dashboard after payment
- [ ] Check user credits were added correctly

---

## Why This Column Is Useful

The `purchased_at` timestamp helps with:
- **Analytics**: Track when users purchased each agent
- **Support**: Quick lookup of purchase history
- **Auditing**: Payment verification trail
- **Business Intelligence**: Monthly/weekly purchase trends

It's a good column to have, which is why the RPC function was trying to use it. It just wasn't created when the `user_agents` table was initially set up.

---

## Next Steps After Fix

Once this is resolved, you can focus on:

1. ✅ Building frontend credential forms for each platform
2. ✅ Testing the complete workflow execution with user credentials
3. ✅ Updating your n8n workflows to use the credential expressions
4. ✅ Testing end-to-end: credential save → payment → workflow execution

---

**Questions?** Just let me know if you encounter any issues running this migration!
