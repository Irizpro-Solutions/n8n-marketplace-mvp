-- Migration: Simple Multi-Platform Credential System (Safe Version)
-- Description: Extends credential system to support multiple platforms WITHOUT OAuth complexity
-- Created: 2026-01-28
-- Note: Safe to run even if some parts already exist

-- ============================================================================
-- 1. Create credential type enum (IF NOT EXISTS)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE credential_type AS ENUM (
    'api_key',       -- API Keys (OpenAI, SERP APIs, Ahrefs)
    'basic_auth',    -- Username + Password (WordPress Application Password)
    'bearer_token'   -- Static bearer tokens
  );
  RAISE NOTICE 'credential_type enum created';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'credential_type enum already exists, skipping';
END $$;

-- ============================================================================
-- 2. Enhance user_agent_credentials table (IF NOT EXISTS)
-- ============================================================================

-- Add columns only if they don't exist
DO $$ BEGIN
  ALTER TABLE user_agent_credentials ADD COLUMN IF NOT EXISTS credential_type credential_type DEFAULT 'api_key';
  RAISE NOTICE 'Added credential_type column';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'credential_type column may already exist';
END $$;

DO $$ BEGIN
  ALTER TABLE user_agent_credentials ADD COLUMN IF NOT EXISTS platform_slug VARCHAR(50);
  RAISE NOTICE 'Added platform_slug column';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'platform_slug column may already exist';
END $$;

DO $$ BEGIN
  ALTER TABLE user_agent_credentials ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
  RAISE NOTICE 'Added is_active column';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'is_active column may already exist';
END $$;

DO $$ BEGIN
  ALTER TABLE user_agent_credentials ADD COLUMN IF NOT EXISTS metadata JSONB;
  RAISE NOTICE 'Added metadata column';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'metadata column may already exist';
END $$;

-- Add comments
COMMENT ON COLUMN user_agent_credentials.credential_type IS 'Type of credential: api_key, basic_auth, bearer_token';
COMMENT ON COLUMN user_agent_credentials.platform_slug IS 'Platform identifier (wordpress, openai, ahrefs, etc.)';
COMMENT ON COLUMN user_agent_credentials.is_active IS 'False if user disconnected this credential';
COMMENT ON COLUMN user_agent_credentials.metadata IS 'Platform-specific data (e.g., {"site_url": "https://example.com", "account_name": "My Blog"})';

-- Add indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_user_agent_credentials_platform
  ON user_agent_credentials(platform_slug, user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_user_agent_credentials_agent_platform
  ON user_agent_credentials(agent_id, platform_slug, user_id, is_active);

-- ============================================================================
-- 3. Create credential_platform_definitions table (IF NOT EXISTS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS credential_platform_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_slug VARCHAR(50) UNIQUE NOT NULL,
  platform_name VARCHAR(100) NOT NULL,
  credential_type credential_type NOT NULL,
  field_schema JSONB NOT NULL,
  icon_url TEXT,
  description TEXT,
  documentation_url TEXT,
  setup_instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE credential_platform_definitions IS 'Defines available credential platforms and their field schemas';
COMMENT ON COLUMN credential_platform_definitions.field_schema IS 'Array of field definitions: [{"name": "api_key", "label": "API Key", "type": "password", "required": true}]';
COMMENT ON COLUMN credential_platform_definitions.setup_instructions IS 'Instructions for users on how to obtain credentials';

-- Insert default platforms (IF NOT EXISTS)
INSERT INTO credential_platform_definitions (platform_slug, platform_name, credential_type, field_schema, description, setup_instructions)
VALUES
  (
    'wordpress',
    'WordPress',
    'basic_auth',
    '[
      {
        "name": "site_url",
        "label": "WordPress Site URL",
        "type": "url",
        "required": true,
        "placeholder": "https://yoursite.com",
        "help_text": "Your WordPress site URL (e.g., https://myblog.com)"
      },
      {
        "name": "username",
        "label": "WordPress Username",
        "type": "text",
        "required": true,
        "placeholder": "admin",
        "help_text": "Your WordPress admin username"
      },
      {
        "name": "application_password",
        "label": "Application Password",
        "type": "password",
        "required": true,
        "placeholder": "xxxx xxxx xxxx xxxx",
        "help_text": "Generate in WordPress: Users → Profile → Application Passwords"
      }
    ]'::jsonb,
    'Connect your WordPress site to publish content automatically',
    'Go to your WordPress admin → Users → Profile → Scroll to "Application Passwords" → Enter name "AI Marketplace" → Click "Add New Application Password" → Copy the generated password'
  ),
  (
    'openai',
    'OpenAI',
    'api_key',
    '[
      {
        "name": "api_key",
        "label": "OpenAI API Key",
        "type": "password",
        "required": true,
        "placeholder": "sk-...",
        "help_text": "Your OpenAI API key starting with sk-"
      }
    ]'::jsonb,
    'Connect your OpenAI account for AI content generation',
    'Go to https://platform.openai.com/api-keys → Click "Create new secret key" → Copy the key'
  ),
  (
    'ahrefs',
    'Ahrefs',
    'api_key',
    '[
      {
        "name": "api_token",
        "label": "Ahrefs API Token",
        "type": "password",
        "required": true,
        "placeholder": "token_...",
        "help_text": "Your Ahrefs API token"
      }
    ]'::jsonb,
    'Connect Ahrefs for SEO data and keyword research',
    'Go to Ahrefs → Account Settings → API → Copy your API token'
  ),
  (
    'semrush',
    'SEMrush',
    'api_key',
    '[
      {
        "name": "api_key",
        "label": "SEMrush API Key",
        "type": "password",
        "required": true,
        "placeholder": "...",
        "help_text": "Your SEMrush API key"
      }
    ]'::jsonb,
    'Connect SEMrush for competitive research and SEO analysis',
    'Go to SEMrush → Profile Settings → API → Copy your API key'
  ),
  (
    'serpapi',
    'SerpAPI',
    'api_key',
    '[
      {
        "name": "api_key",
        "label": "SerpAPI Key",
        "type": "password",
        "required": true,
        "placeholder": "...",
        "help_text": "Your SerpAPI key for Google search results"
      }
    ]'::jsonb,
    'Connect SerpAPI for search engine results data',
    'Go to https://serpapi.com/manage-api-key → Copy your API key'
  )
ON CONFLICT (platform_slug) DO NOTHING;

-- Create trigger function (IF NOT EXISTS)
CREATE OR REPLACE FUNCTION update_credential_platform_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger to ensure it exists
DROP TRIGGER IF EXISTS credential_platform_definitions_updated_at ON credential_platform_definitions;
CREATE TRIGGER credential_platform_definitions_updated_at
  BEFORE UPDATE ON credential_platform_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_credential_platform_definitions_updated_at();

-- ============================================================================
-- 4. Update agents table to support platform requirements (IF NOT EXISTS)
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE agents ADD COLUMN IF NOT EXISTS required_platforms TEXT[];
  RAISE NOTICE 'Added required_platforms column to agents';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'required_platforms column may already exist';
END $$;

COMMENT ON COLUMN agents.required_platforms IS 'Array of platform slugs required for this agent (e.g., ["wordpress", "openai", "ahrefs"])';

-- ============================================================================
-- 5. Create helper function (replace if exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION user_has_required_credentials(
  p_user_id UUID,
  p_agent_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_required_platforms TEXT[];
  v_platform TEXT;
  v_has_credential BOOLEAN;
BEGIN
  -- Get required platforms for agent
  SELECT required_platforms INTO v_required_platforms
  FROM agents
  WHERE id = p_agent_id;

  -- If no platforms required, return true
  IF v_required_platforms IS NULL OR array_length(v_required_platforms, 1) = 0 THEN
    RETURN true;
  END IF;

  -- Check each required platform
  FOREACH v_platform IN ARRAY v_required_platforms
  LOOP
    -- Check if user has active credential for this platform
    SELECT EXISTS(
      SELECT 1
      FROM user_agent_credentials
      WHERE user_id = p_user_id
        AND agent_id = p_agent_id
        AND platform_slug = v_platform
        AND is_active = true
    ) INTO v_has_credential;

    -- If any platform is missing, return false
    IF NOT v_has_credential THEN
      RETURN false;
    END IF;
  END LOOP;

  -- All required platforms have credentials
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION user_has_required_credentials IS 'Check if user has provided all required credentials for an agent';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  platform_count INTEGER;
  column_exists BOOLEAN;
BEGIN
  -- Check platforms
  SELECT COUNT(*) INTO platform_count
  FROM credential_platform_definitions;

  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '✅ credential_type enum ready';
  RAISE NOTICE '✅ user_agent_credentials table enhanced';
  RAISE NOTICE '✅ Found % platform definitions', platform_count;

  -- Verify critical columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_agent_credentials'
    AND column_name = 'platform_slug'
  ) INTO column_exists;

  IF column_exists THEN
    RAISE NOTICE '✅ platform_slug column exists';
  ELSE
    RAISE WARNING '⚠️ platform_slug column missing - check migration logs';
  END IF;

  -- Verify agents column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents'
    AND column_name = 'required_platforms'
  ) INTO column_exists;

  IF column_exists THEN
    RAISE NOTICE '✅ agents.required_platforms column exists';
  ELSE
    RAISE WARNING '⚠️ required_platforms column missing - check migration logs';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '🎉 All done! You can now:';
  RAISE NOTICE '1. Update agent: UPDATE agents SET required_platforms = ARRAY[''wordpress'', ''openai''] WHERE id = ''your-agent-id'';';
  RAISE NOTICE '2. Test credential save API';
  RAISE NOTICE '3. Build frontend forms';
END $$;
