-- ==================================================
-- ENTERPRISE SECURITY: LOCK DOWN ALL PUBLIC TABLES
-- ==================================================
-- This migration enables RLS on all "public" tables
-- Only service_role can access these tables directly
-- Users must go through API routes
-- ==================================================

-- ==================================================
-- 1. ENABLE RLS ON PUBLIC CATALOG TABLES
-- ==================================================

-- Enable RLS on agents (marketplace catalog)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Enable RLS on credit_packages (pricing)
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;

-- Enable RLS on credential_platform_definitions (platform configs)
ALTER TABLE credential_platform_definitions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on workflows (legacy mappings)
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

-- ==================================================
-- 2. CREATE SERVICE_ROLE-ONLY POLICIES
-- ==================================================
-- These policies ONLY allow service_role (server-side) access
-- Anon and authenticated users are blocked from direct access

-- -------------------- AGENTS POLICIES --------------------
-- Only service_role can read agents
CREATE POLICY "Service role can read agents"
  ON agents
  FOR SELECT
  TO service_role
  USING (true);

-- Only service_role can insert agents
CREATE POLICY "Service role can insert agents"
  ON agents
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Only service_role can update agents
CREATE POLICY "Service role can update agents"
  ON agents
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Only service_role can delete agents
CREATE POLICY "Service role can delete agents"
  ON agents
  FOR DELETE
  TO service_role
  USING (true);

-- -------------------- CREDIT_PACKAGES POLICIES --------------------
CREATE POLICY "Service role can read credit_packages"
  ON credit_packages
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert credit_packages"
  ON credit_packages
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update credit_packages"
  ON credit_packages
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete credit_packages"
  ON credit_packages
  FOR DELETE
  TO service_role
  USING (true);

-- -------------------- CREDENTIAL_PLATFORM_DEFINITIONS POLICIES --------------------
CREATE POLICY "Service role can read platform definitions"
  ON credential_platform_definitions
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert platform definitions"
  ON credential_platform_definitions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update platform definitions"
  ON credential_platform_definitions
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete platform definitions"
  ON credential_platform_definitions
  FOR DELETE
  TO service_role
  USING (true);

-- -------------------- WORKFLOWS POLICIES --------------------
CREATE POLICY "Service role can read workflows"
  ON workflows
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert workflows"
  ON workflows
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update workflows"
  ON workflows
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete workflows"
  ON workflows
  FOR DELETE
  TO service_role
  USING (true);

-- ==================================================
-- 3. REVOKE DIRECT ACCESS FROM PUBLIC ROLES
-- ==================================================
-- Remove any existing grants to anon and authenticated

-- Revoke direct access to agents
REVOKE SELECT, INSERT, UPDATE, DELETE ON agents FROM anon, authenticated;

-- Revoke direct access to credit_packages
REVOKE SELECT, INSERT, UPDATE, DELETE ON credit_packages FROM anon, authenticated;

-- Revoke direct access to credential_platform_definitions
REVOKE SELECT, INSERT, UPDATE, DELETE ON credential_platform_definitions FROM anon, authenticated;

-- Revoke direct access to workflows
REVOKE SELECT, INSERT, UPDATE, DELETE ON workflows FROM anon, authenticated;

-- ==================================================
-- 4. VERIFY RLS CONFIGURATION
-- ==================================================

-- Verify all tables now have RLS enabled
DO $$
DECLARE
  v_table TEXT;
  v_rls_enabled BOOLEAN;
BEGIN
  FOR v_table IN
    SELECT unnest(ARRAY['agents', 'credit_packages', 'credential_platform_definitions', 'workflows',
                        'profiles', 'user_agents', 'credit_purchases', 'credit_transactions',
                        'agent_executions', 'user_agent_credentials', 'oauth_states', 'audit_logs'])
  LOOP
    SELECT rowsecurity INTO v_rls_enabled
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = v_table;

    IF v_rls_enabled IS NULL OR v_rls_enabled = false THEN
      RAISE EXCEPTION 'RLS not enabled on table: %', v_table;
    END IF;

    RAISE NOTICE 'RLS verified on table: %', v_table;
  END LOOP;
END $$;

-- ==================================================
-- 5. ADD SECURITY COMMENTS
-- ==================================================

COMMENT ON TABLE agents IS 'Marketplace catalog - RLS enabled, service_role only (enterprise security)';
COMMENT ON TABLE credit_packages IS 'Credit pricing - RLS enabled, service_role only (enterprise security)';
COMMENT ON TABLE credential_platform_definitions IS 'Platform configs - RLS enabled, service_role only (enterprise security)';
COMMENT ON TABLE workflows IS 'Workflow mappings - RLS enabled, service_role only (enterprise security)';

-- ==================================================
-- MIGRATION COMPLETE
-- ==================================================

INSERT INTO _migrations (name, executed_at)
VALUES ('20260202_enterprise_security_lockdown', NOW());

-- ==================================================
-- SECURITY STATUS AFTER MIGRATION
-- ==================================================
-- ✅ ALL tables have RLS enabled
-- ✅ Direct browser access blocked (anon/authenticated)
-- ✅ Only service_role can query tables
-- ✅ Users must use API routes
-- ✅ Enterprise-level defense in depth

-- ==================================================
-- NEXT STEPS
-- ==================================================
-- 1. Create API routes: /api/agents/list, /api/credit-packages/list, etc.
-- 2. Update frontend to use API routes instead of direct Supabase queries
-- 3. Add rate limiting to API routes
-- 4. Add response caching for performance
-- 5. Test thoroughly with browser console (should be blocked)
