-- Migration: Fix Credential Unique Constraint for Platform-Based System
-- Description: Change unique constraint from (user_id, agent_id) to (user_id, agent_id, platform_slug)
-- This allows multiple credentials per agent (one per platform)
-- Created: 2026-01-30

-- ============================================================================
-- 1. Drop old unique constraint
-- ============================================================================

-- Find and drop the old constraint
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Find the constraint name
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'user_agent_credentials'
    AND con.contype = 'u'
    AND array_length(con.conkey, 1) = 2;  -- Constraint with 2 columns

  -- Drop if found
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE user_agent_credentials DROP CONSTRAINT %I', constraint_name);
    RAISE NOTICE 'Dropped old unique constraint: %', constraint_name;
  ELSE
    RAISE NOTICE 'No old unique constraint found (may already be dropped)';
  END IF;
END $$;

-- ============================================================================
-- 2. Add new unique constraint with platform_slug
-- ============================================================================

-- Add new constraint: one credential per user-agent-platform combination
DO $$
BEGIN
  ALTER TABLE user_agent_credentials
    ADD CONSTRAINT user_agent_credentials_user_agent_platform_key
    UNIQUE (user_id, agent_id, platform_slug);

  RAISE NOTICE 'Added new unique constraint with platform_slug';
EXCEPTION
  WHEN duplicate_table THEN
    RAISE NOTICE 'Unique constraint already exists';
END $$;

-- ============================================================================
-- 3. Ensure platform_slug is NOT NULL (required for unique constraint)
-- ============================================================================

-- Make platform_slug NOT NULL (if not already)
DO $$
BEGIN
  ALTER TABLE user_agent_credentials
    ALTER COLUMN platform_slug SET NOT NULL;

  RAISE NOTICE 'Set platform_slug to NOT NULL';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'platform_slug may already be NOT NULL or have NULL values';
END $$;

-- ============================================================================
-- 4. Update comment
-- ============================================================================

COMMENT ON TABLE user_agent_credentials IS 'Stores encrypted credential values per user-agent-platform combination';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- After this migration:
-- - Users can store MULTIPLE credentials per agent (one per platform)
-- - Each user-agent-platform combination has ONE credential entry
-- - Example: User 1 + Agent A + WordPress = 1 entry
--            User 1 + Agent A + OpenAI = 1 entry (separate)
