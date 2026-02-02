-- ==================================================
-- EMERGENCY FIX: ENABLE RLS ON ALL USER DATA TABLES
-- ==================================================
-- Run this script to enable Row Level Security
-- ==================================================

-- Enable RLS on all user data tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_agent_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Verify RLS is enabled
SELECT
  tablename,
  CASE
    WHEN rowsecurity = true THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'user_agents',
    'credit_purchases',
    'credit_transactions',
    'agent_executions',
    'user_agent_credentials',
    'oauth_states',
    'audit_logs'
  )
ORDER BY tablename;
