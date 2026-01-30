-- Migration: OAuth 2.0 Credential System Enhancement
-- Description: Extends credential system to support OAuth 2.0, token refresh, and multiple credential types
-- Created: 2026-01-28

-- ============================================================================
-- 1. Add credential type enum
-- ============================================================================

CREATE TYPE credential_type AS ENUM (
  'oauth2',        -- OAuth 2.0 (Google, WordPress OAuth, LinkedIn)
  'api_key',       -- API Keys (OpenAI, SERP APIs, Ahrefs)
  'basic_auth',    -- Username + Password (Legacy systems)
  'bearer_token'   -- Static bearer tokens
);

-- ============================================================================
-- 2. Enhance user_agent_credentials table
-- ============================================================================

-- Add new columns for OAuth support
ALTER TABLE user_agent_credentials
ADD COLUMN credential_type credential_type DEFAULT 'api_key',
ADD COLUMN platform_slug VARCHAR(50),  -- e.g., 'wordpress', 'google_search_console'
ADD COLUMN access_token_encrypted TEXT,  -- OAuth access token (encrypted separately)
ADD COLUMN refresh_token_encrypted TEXT, -- OAuth refresh token
ADD COLUMN token_expires_at TIMESTAMP WITH TIME ZONE,  -- Access token expiry
ADD COLUMN token_scope TEXT,  -- OAuth scopes granted
ADD COLUMN platform_user_id TEXT,  -- User ID on the platform (e.g., Google user ID)
ADD COLUMN platform_user_email TEXT,  -- User email on the platform
ADD COLUMN is_active BOOLEAN DEFAULT true,  -- Allow users to disconnect
ADD COLUMN last_refreshed_at TIMESTAMP WITH TIME ZONE,  -- Track token refresh
ADD COLUMN metadata JSONB;  -- Additional platform-specific data

-- Add comments
COMMENT ON COLUMN user_agent_credentials.credential_type IS 'Type of credential: oauth2, api_key, basic_auth, bearer_token';
COMMENT ON COLUMN user_agent_credentials.platform_slug IS 'Platform identifier (wordpress, google, openai, etc.)';
COMMENT ON COLUMN user_agent_credentials.access_token_encrypted IS 'Encrypted OAuth access token';
COMMENT ON COLUMN user_agent_credentials.refresh_token_encrypted IS 'Encrypted OAuth refresh token';
COMMENT ON COLUMN user_agent_credentials.token_expires_at IS 'When access token expires (for OAuth)';
COMMENT ON COLUMN user_agent_credentials.is_active IS 'False if user disconnected this credential';
COMMENT ON COLUMN user_agent_credentials.metadata IS 'Platform-specific data (account name, profile picture, etc.)';

-- Add index for token expiry queries (for refresh background job)
CREATE INDEX idx_user_agent_credentials_token_expiry
  ON user_agent_credentials(token_expires_at)
  WHERE is_active = true AND credential_type = 'oauth2';

-- Add index for platform queries
CREATE INDEX idx_user_agent_credentials_platform
  ON user_agent_credentials(platform_slug, user_id);

-- ============================================================================
-- 3. Create credential_field_definitions table (optional but recommended)
-- ============================================================================

-- Stores metadata about each credential field type
CREATE TABLE credential_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_slug VARCHAR(50) UNIQUE NOT NULL,  -- e.g., 'wordpress', 'openai'
  platform_name VARCHAR(100) NOT NULL,  -- e.g., 'WordPress', 'OpenAI'
  credential_type credential_type NOT NULL,

  -- OAuth configuration
  oauth_config JSONB,  -- { "auth_url", "token_url", "scope", "client_id_env" }

  -- Field definitions
  field_schema JSONB,  -- Array of field definitions for non-OAuth

  -- UI display
  icon_url TEXT,
  description TEXT,
  documentation_url TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE credential_field_definitions IS 'Defines available credential platforms and their configuration';

-- Add some default platforms
INSERT INTO credential_field_definitions (platform_slug, platform_name, credential_type, oauth_config, field_schema) VALUES
-- OAuth platforms
('wordpress_oauth', 'WordPress (OAuth)', 'oauth2',
  '{"auth_url": "https://public-api.wordpress.com/oauth2/authorize", "token_url": "https://public-api.wordpress.com/oauth2/token", "scope": "global", "provider": "wordpress"}',
  NULL
),
('google_search_console', 'Google Search Console', 'oauth2',
  '{"auth_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token", "scope": "https://www.googleapis.com/auth/webmasters.readonly", "provider": "google"}',
  NULL
),
('google_analytics', 'Google Analytics', 'oauth2',
  '{"auth_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token", "scope": "https://www.googleapis.com/auth/analytics.readonly", "provider": "google"}',
  NULL
),

-- API Key platforms
('openai', 'OpenAI', 'api_key',
  NULL,
  '[{"name": "api_key", "label": "API Key", "type": "password", "required": true, "placeholder": "sk-..."}]'
),
('ahrefs', 'Ahrefs', 'api_key',
  NULL,
  '[{"name": "api_token", "label": "API Token", "type": "password", "required": true}]'
),
('semrush', 'SEMrush', 'api_key',
  NULL,
  '[{"name": "api_key", "label": "API Key", "type": "password", "required": true}]'
),

-- Basic Auth platforms
('wordpress_basic', 'WordPress (Application Password)', 'basic_auth',
  NULL,
  '[{"name": "site_url", "label": "WordPress Site URL", "type": "url", "required": true, "placeholder": "https://yoursite.com"}, {"name": "username", "label": "Username", "type": "text", "required": true}, {"name": "application_password", "label": "Application Password", "type": "password", "required": true, "help_text": "Generate in WordPress: Users → Profile → Application Passwords"}]'
);

-- Add updated_at trigger
CREATE TRIGGER credential_field_definitions_updated_at
  BEFORE UPDATE ON credential_field_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_agent_credentials_updated_at();

-- ============================================================================
-- 4. Create OAuth state tracking table
-- ============================================================================

-- Stores OAuth state during authorization flow (CSRF protection)
CREATE TABLE oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_token VARCHAR(255) UNIQUE NOT NULL,  -- Random CSRF token
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  platform_slug VARCHAR(50) NOT NULL,

  -- OAuth flow data
  code_verifier TEXT,  -- PKCE code verifier
  redirect_uri TEXT NOT NULL,

  -- Expiry (OAuth states expire after 10 minutes)
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),

  -- Completion tracking
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS policies
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own OAuth states"
  ON oauth_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own OAuth states"
  ON oauth_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for cleanup job
CREATE INDEX idx_oauth_states_expiry ON oauth_states(expires_at) WHERE is_completed = false;

-- Cleanup expired states (run via cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_states
  WHERE expires_at < NOW() AND is_completed = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Update agents table to support platform requirements
-- ============================================================================

-- Add required_platforms column (array of platform slugs)
ALTER TABLE agents
ADD COLUMN required_platforms TEXT[];

COMMENT ON COLUMN agents.required_platforms IS 'Array of platform slugs required for this agent (e.g., ["wordpress_oauth", "openai"])';

-- Example: Agent requires both WordPress OAuth and OpenAI API key
-- required_platforms = ["wordpress_oauth", "openai"]

-- ============================================================================
-- Migration Complete
-- ============================================================================
