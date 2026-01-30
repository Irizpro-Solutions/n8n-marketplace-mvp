-- Migration: Simple Multi-Platform Credential System
-- Description: Extends credential system to support multiple platforms WITHOUT OAuth complexity
-- Created: 2026-01-28
-- Use Case: Store WordPress credentials, API keys, etc. per platform

-- ============================================================================
-- 1. Add credential type enum
-- ============================================================================

CREATE TYPE credential_type AS ENUM (
  'api_key',       -- API Keys (OpenAI, SERP APIs, Ahrefs)
  'basic_auth',    -- Username + Password (WordPress Application Password)
  'bearer_token'   -- Static bearer tokens
);

-- ============================================================================
-- 2. Enhance user_agent_credentials table
-- ============================================================================

-- Add new columns for platform-based credentials
ALTER TABLE user_agent_credentials
ADD COLUMN IF NOT EXISTS credential_type credential_type DEFAULT 'api_key',
ADD COLUMN IF NOT EXISTS platform_slug VARCHAR(50),  -- e.g., 'wordpress', 'openai', 'ahrefs'
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,  -- Allow users to disconnect
ADD COLUMN IF NOT EXISTS metadata JSONB;  -- Additional platform-specific data (e.g., site_url, account_name)

-- Add comments
COMMENT ON COLUMN user_agent_credentials.credential_type IS 'Type of credential: api_key, basic_auth, bearer_token';
COMMENT ON COLUMN user_agent_credentials.platform_slug IS 'Platform identifier (wordpress, openai, ahrefs, etc.)';
COMMENT ON COLUMN user_agent_credentials.is_active IS 'False if user disconnected this credential';
COMMENT ON COLUMN user_agent_credentials.metadata IS 'Platform-specific data (e.g., {"site_url": "https://example.com", "account_name": "My Blog"})';

-- Add index for platform queries
CREATE INDEX IF NOT EXISTS idx_user_agent_credentials_platform
  ON user_agent_credentials(platform_slug, user_id, is_active);

-- Add index for agent + platform lookup (common query)
CREATE INDEX IF NOT EXISTS idx_user_agent_credentials_agent_platform
  ON user_agent_credentials(agent_id, platform_slug, user_id, is_active);

-- ============================================================================
-- 3. Create credential_platform_definitions table
-- ============================================================================

-- Stores metadata about each platform (WordPress, OpenAI, etc.)
CREATE TABLE IF NOT EXISTS credential_platform_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_slug VARCHAR(50) UNIQUE NOT NULL,  -- e.g., 'wordpress', 'openai'
  platform_name VARCHAR(100) NOT NULL,  -- e.g., 'WordPress', 'OpenAI'
  credential_type credential_type NOT NULL,

  -- Field definitions for user input form
  field_schema JSONB NOT NULL,  -- Array of field definitions

  -- UI display
  icon_url TEXT,
  description TEXT,
  documentation_url TEXT,
  setup_instructions TEXT,  -- How to get these credentials

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE credential_platform_definitions IS 'Defines available credential platforms and their field schemas';
COMMENT ON COLUMN credential_platform_definitions.field_schema IS 'Array of field definitions: [{"name": "api_key", "label": "API Key", "type": "password", "required": true}]';
COMMENT ON COLUMN credential_platform_definitions.setup_instructions IS 'Instructions for users on how to obtain credentials';

-- Add some default platforms
INSERT INTO credential_platform_definitions (platform_slug, platform_name, credential_type, field_schema, description, setup_instructions) VALUES

-- WordPress (Application Password)
('wordpress', 'WordPress', 'basic_auth',
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

-- OpenAI
('openai', 'OpenAI', 'api_key',
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

-- Ahrefs
('ahrefs', 'Ahrefs', 'api_key',
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

-- SEMrush
('semrush', 'SEMrush', 'api_key',
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

-- SERP API
('serpapi', 'SerpAPI', 'api_key',
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
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_credential_platform_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER credential_platform_definitions_updated_at
  BEFORE UPDATE ON credential_platform_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_credential_platform_definitions_updated_at();

-- ============================================================================
-- 4. Update agents table to support platform requirements
-- ============================================================================

-- Add required_platforms column (array of platform slugs)
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS required_platforms TEXT[];

COMMENT ON COLUMN agents.required_platforms IS 'Array of platform slugs required for this agent (e.g., ["wordpress", "openai", "ahrefs"])';

-- Example: Agent requires WordPress and OpenAI
-- UPDATE agents SET required_platforms = ARRAY['wordpress', 'openai'] WHERE id = 'agent_id';

-- ============================================================================
-- 5. Add helper function to check if user has all required credentials
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
-- Migration Complete
-- ============================================================================

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'credential_type enum created: api_key, basic_auth, bearer_token';
  RAISE NOTICE 'user_agent_credentials table enhanced with platform support';
  RAISE NOTICE 'credential_platform_definitions table created with 5 default platforms';
  RAISE NOTICE 'agents.required_platforms column added';
  RAISE NOTICE 'Helper function user_has_required_credentials() created';
END $$;
