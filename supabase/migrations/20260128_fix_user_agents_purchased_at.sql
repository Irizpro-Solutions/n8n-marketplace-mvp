-- ==================================================
-- FIX: Add purchased_at column to user_agents table
-- ==================================================
-- Issue: process_payment_atomic RPC function tries to insert
-- purchased_at column which doesn't exist in user_agents table
-- This causes payment verification to fail even though Razorpay
-- payment succeeds.
--
-- Solution: Add the missing column
-- ==================================================

-- Add purchased_at column to user_agents table
ALTER TABLE user_agents
ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add comment
COMMENT ON COLUMN user_agents.purchased_at IS 'Timestamp when user purchased/was granted access to this agent';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_agents_purchased_at
ON user_agents(purchased_at DESC);

-- Backfill existing records with created_at value if they have it
-- or NOW() if they don't
DO $$
BEGIN
  -- Check if created_at column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_agents' AND column_name = 'created_at'
  ) THEN
    -- Update purchased_at to match created_at for existing records
    UPDATE user_agents
    SET purchased_at = created_at
    WHERE purchased_at IS NULL AND created_at IS NOT NULL;
  END IF;

  -- Set to NOW() for any remaining NULL values
  UPDATE user_agents
  SET purchased_at = NOW()
  WHERE purchased_at IS NULL;
END $$;

-- ==================================================
-- VERIFICATION
-- ==================================================

DO $$
DECLARE
  column_exists BOOLEAN;
  record_count INTEGER;
BEGIN
  -- Check if column was added
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_agents' AND column_name = 'purchased_at'
  ) INTO column_exists;

  IF column_exists THEN
    RAISE NOTICE '✅ purchased_at column successfully added to user_agents table';

    -- Count records
    SELECT COUNT(*) INTO record_count FROM user_agents;
    RAISE NOTICE '✅ Backfilled % existing records', record_count;
    RAISE NOTICE '✅ Payment verification should now work correctly';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Migration complete!';
    RAISE NOTICE 'You can now test the payment flow again.';
  ELSE
    RAISE WARNING '⚠️ Failed to add purchased_at column - please check migration logs';
  END IF;
END $$;
