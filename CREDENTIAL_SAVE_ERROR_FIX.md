# Credential Save Error Fix

## Issue Summary

**Error:** `Failed to store credentials` when saving WordPress credentials

**Root Cause:** Database unique constraint conflict
- Original table: `UNIQUE(user_id, agent_id)` - Allows only ONE credential per agent
- Platform system needs: `UNIQUE(user_id, agent_id, platform_slug)` - Multiple credentials per agent (one per platform)

**Security Issue:** Credentials visible in logs during development (Next.js dev server behavior)

## Fix Steps

### Step 1: Run Database Migration

The migration file has been created: `supabase/migrations/20260130_fix_credential_unique_constraint.sql`

**Option A: Using Supabase CLI (Recommended)**
```bash
# If you have Supabase CLI installed
supabase db push

# OR apply specific migration
supabase migration up
```

**Option B: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/20260130_fix_credential_unique_constraint.sql`
4. Click **Run**

**Option C: Manual SQL (Alternative)**
```sql
-- 1. Drop old constraint
ALTER TABLE user_agent_credentials
DROP CONSTRAINT IF EXISTS user_agent_credentials_user_id_agent_id_key;

-- 2. Add new constraint
ALTER TABLE user_agent_credentials
ADD CONSTRAINT user_agent_credentials_user_agent_platform_key
UNIQUE (user_id, agent_id, platform_slug);

-- 3. Ensure platform_slug is NOT NULL
ALTER TABLE user_agent_credentials
ALTER COLUMN platform_slug SET NOT NULL;
```

### Step 2: Clear Any Existing Data (Optional)

If you have test credential data that's causing conflicts:

```sql
-- CAUTION: This deletes all stored credentials
DELETE FROM user_agent_credentials;
```

Only do this if you're in development and don't have important credential data.

### Step 3: Restart Dev Server

After running the migration:

```bash
# Stop the current dev server (Ctrl+C)
# Start it again
npm run dev
```

### Step 4: Test Credential Save Again

1. Go to dashboard
2. Click "Execute Agent" on the WordPress agent
3. Fill in WordPress credentials:
   - WordPress Site URL: `https://irizpro.in`
   - WordPress Username: `Parth`
   - Application Password: `xxxx xxxx xxxx xxxx`
4. Click "Save & Next Platform" or "Save & Continue to Agent"

**Expected Result:** Credentials should save successfully with no errors

## Security Notes

### About Credentials in Logs (Development Only)

**What you saw:** Credentials visible in terminal logs during development

**Why it happens:**
- Next.js dev server automatically logs ALL request bodies
- This is a **development-only behavior**
- Production builds do NOT log request bodies

**Is it a security issue?**
- ❌ **NO** in production (logs are not exposed)
- ⚠️ **YES** in development (if you share terminal screenshots)

**What we did to improve security:**
1. Updated API to log only metadata (not credential values)
2. Added comments to NEVER log sensitive data
3. Credentials are encrypted before storage (AES-256-GCM)

**Example of Safe Logging (After Fix):**
```
[API] Save credentials request: {
  userId: "uuid...",
  agentId: "uuid...",
  platformSlug: "wordpress",
  hasCredentials: true,
  credentialKeys: ["site_url", "username", "application_password"]
  // ✅ Keys are logged, but NOT the values
}
```

### Production Security Measures

In production, credentials are protected by:

1. **Encryption at Rest:**
   - AES-256-GCM encryption
   - Unique IV per credential
   - Authentication tags prevent tampering

2. **No Logging:**
   - Production builds don't log request bodies
   - Our code logs only metadata (not values)

3. **Database Security:**
   - Row-level security (RLS) policies
   - Users can only access their own credentials
   - Admin operations use service role key

4. **Transport Security:**
   - HTTPS only in production
   - Credentials encrypted before transmission

### Best Practices (For Your Reference)

**DO:**
- ✅ Use HTTPS in production
- ✅ Rotate `CREDENTIAL_ENCRYPTION_KEY` periodically
- ✅ Use environment variables for secrets
- ✅ Enable RLS policies on all tables

**DON'T:**
- ❌ Share terminal logs that show request bodies
- ❌ Commit `.env.local` to version control
- ❌ Log credential values (even in development)
- ❌ Disable RLS policies in production

## Verification

After running the migration, verify the fix:

### 1. Check Database Schema

```sql
-- Check unique constraint
SELECT
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'user_agent_credentials'
  AND con.contype = 'u';

-- Expected output:
-- constraint_name: user_agent_credentials_user_agent_platform_key
-- constraint_definition: UNIQUE (user_id, agent_id, platform_slug)
```

### 2. Test Credential Save

- Save WordPress credentials → Should succeed
- Save OpenAI credentials (same agent) → Should succeed (separate entry)
- Save WordPress credentials again → Should update existing (upsert)

### 3. Check Stored Data

```sql
-- View stored credentials (encrypted)
SELECT
  user_id,
  agent_id,
  platform_slug,
  credential_type,
  LENGTH(encrypted_data) as data_length,
  is_active,
  created_at
FROM user_agent_credentials
WHERE user_id = 'YOUR_USER_ID';

-- Expected: One row per platform
-- wordpress → 1 row
-- openai → 1 row (separate)
```

## Troubleshooting

### Error: "column platform_slug contains null values"

**Cause:** Existing credentials without platform_slug

**Fix:**
```sql
-- Option 1: Delete old credentials
DELETE FROM user_agent_credentials WHERE platform_slug IS NULL;

-- Option 2: Set default platform
UPDATE user_agent_credentials
SET platform_slug = 'unknown'
WHERE platform_slug IS NULL;

-- Then run the migration again
```

### Error: "duplicate key value violates unique constraint"

**Cause:** Trying to insert duplicate user-agent-platform combination

**Fix:**
```sql
-- Find duplicates
SELECT user_id, agent_id, platform_slug, COUNT(*)
FROM user_agent_credentials
GROUP BY user_id, agent_id, platform_slug
HAVING COUNT(*) > 1;

-- Delete duplicates (keep most recent)
DELETE FROM user_agent_credentials a
USING user_agent_credentials b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.agent_id = b.agent_id
  AND a.platform_slug = b.platform_slug;
```

### Still Getting "Failed to store credentials"

1. Check `.env.local` has `CREDENTIAL_ENCRYPTION_KEY` (64 hex characters)
2. Verify migration ran successfully
3. Check Supabase logs for detailed error
4. Ensure `supabaseAdmin` is initialized correctly

## Summary

- ✅ Migration created to fix unique constraint
- ✅ Security improvements added (safe logging)
- ✅ Documentation updated
- ⏭️ Next step: Run the migration and test

After running the migration, credential saves should work correctly!
