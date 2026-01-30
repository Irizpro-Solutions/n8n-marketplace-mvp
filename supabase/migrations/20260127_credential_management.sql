-- Migration: Credential Management System
-- Description: Add credential fields to agents and create user_agent_credentials table
-- Created: 2026-01-27

-- ============================================================================
-- 1. Add credential_fields column to agents table
-- ============================================================================

-- Add credential_fields column to agents table (stores field titles defined by admin)
ALTER TABLE agents
ADD COLUMN credential_fields JSONB;

COMMENT ON COLUMN agents.credential_fields IS 'Array of credential field titles that users need to provide (e.g., ["OpenAI API Key", "WordPress URL"])';

-- Example structure: ["OpenAI API Key", "WordPress Site URL", "API Secret"]


-- ============================================================================
-- 2. Create user_agent_credentials table
-- ============================================================================

-- Stores encrypted credential values per user-agent pair
CREATE TABLE user_agent_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Encrypted credential data (AES-256-GCM)
  encrypted_data TEXT NOT NULL,  -- Base64-encoded encrypted JSON
  encryption_iv TEXT NOT NULL,   -- Initialization vector (16 bytes, base64)
  encryption_tag TEXT NOT NULL,  -- Authentication tag (16 bytes, base64)
  encryption_key_version INTEGER NOT NULL DEFAULT 1,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- ONE set of credentials per user-agent pair
  UNIQUE(user_id, agent_id)
);

-- Add indexes for performance
CREATE INDEX idx_user_agent_credentials_user_id ON user_agent_credentials(user_id);
CREATE INDEX idx_user_agent_credentials_agent_id ON user_agent_credentials(agent_id);

-- Add comment
COMMENT ON TABLE user_agent_credentials IS 'Stores encrypted credential values for each user-agent pair';


-- ============================================================================
-- 3. Enable Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on user_agent_credentials table
ALTER TABLE user_agent_credentials ENABLE ROW LEVEL SECURITY;

-- Users can only view their own credentials
CREATE POLICY "Users can view own credentials"
  ON user_agent_credentials FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own credentials
CREATE POLICY "Users can insert own credentials"
  ON user_agent_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own credentials
CREATE POLICY "Users can update own credentials"
  ON user_agent_credentials FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own credentials
CREATE POLICY "Users can delete own credentials"
  ON user_agent_credentials FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================================
-- 4. Create updated_at trigger
-- ============================================================================

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_agent_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_agent_credentials_updated_at
  BEFORE UPDATE ON user_agent_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_user_agent_credentials_updated_at();


-- ============================================================================
-- Migration Complete
-- ============================================================================
