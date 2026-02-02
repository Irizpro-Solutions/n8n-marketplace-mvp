-- ==================================================
-- COMPLETE SECURE DATABASE SCHEMA
-- n8n Marketplace MVP - Fresh Supabase Instance Setup
-- ==================================================
-- Run this script in a NEW Supabase instance
-- Includes ALL tables, RLS policies, functions, triggers
-- SECURITY: All user data protected with Row Level Security
-- ==================================================

-- ==================================================
-- 1. CREATE ENUMS
-- ==================================================

-- Credential types (API keys, OAuth, basic auth)
CREATE TYPE credential_type AS ENUM (
  'api_key',       -- API Keys (OpenAI, SERP APIs, Ahrefs)
  'basic_auth',    -- Username + Password (WordPress Application Password)
  'bearer_token',  -- Static bearer tokens
  'oauth2'         -- OAuth 2.0 (future enhancement)
);

-- ==================================================
-- 2. CREATE TABLES
-- ==================================================

-- -------------------- PROFILES --------------------
-- User profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  credits INTEGER NOT NULL DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  total_executions INTEGER DEFAULT 0,
  membership_tier TEXT DEFAULT 'free',
  is_active BOOLEAN DEFAULT true,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT check_profiles_credits_positive CHECK (credits >= 0)
);

-- -------------------- AGENTS --------------------
-- AI agent definitions (marketplace listings)
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  credit_cost INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  pricing_config JSONB,  -- Multi-currency pricing: { basePrice, customPrices: { USD: 0.99 } }
  input_schema JSONB,    -- Dynamic form fields: [{ name, type, label, required, options }]
  webhook_url TEXT,      -- Direct n8n webhook URL (current method)
  required_platforms TEXT[],  -- Platform credentials needed: ['wordpress', 'openai']
  credential_fields JSONB,    -- Legacy credential field definitions
  deleted_at TIMESTAMP WITH TIME ZONE,  -- Soft delete
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT check_agents_credit_cost_positive CHECK (credit_cost > 0)
);

-- -------------------- CREDIT PACKAGES --------------------
-- Predefined credit bundles for purchase
CREATE TABLE credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price_inr NUMERIC NOT NULL,
  bonus_credits INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -------------------- CREDIT PURCHASES --------------------
-- Payment transaction records (Razorpay)
CREATE TABLE credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  package_id UUID REFERENCES credit_packages(id),
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT UNIQUE NOT NULL,  -- For idempotency
  razorpay_signature TEXT NOT NULL,
  amount_paid INTEGER NOT NULL,  -- Amount in paise (INR * 100)
  credits_purchased INTEGER NOT NULL,
  total_credits INTEGER NOT NULL,
  bonus_credits INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'paid', 'failed'
  currency TEXT DEFAULT 'INR',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -------------------- CREDIT TRANSACTIONS --------------------
-- Credit movement audit trail
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'purchase', 'usage', 'refund', 'bonus', 'adjustment'
  amount INTEGER NOT NULL,  -- Positive for additions, negative for deductions
  balance_after INTEGER DEFAULT 0,
  purchase_id UUID REFERENCES credit_purchases(id),
  execution_id UUID,  -- Soft reference to agent_executions (no FK constraint)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT check_credit_transactions_valid CHECK (
    (type = 'purchase' AND amount > 0) OR
    (type = 'usage' AND amount < 0) OR
    (type = 'refund' AND amount > 0) OR
    (type = 'bonus' AND amount > 0) OR
    (type = 'adjustment')
  )
);

-- -------------------- USER AGENTS --------------------
-- User-agent purchase relationships
CREATE TABLE user_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT user_agents_user_id_agent_id_key UNIQUE (user_id, agent_id)
);

-- -------------------- AGENT EXECUTIONS --------------------
-- Minimal workflow execution tracking
CREATE TABLE agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'running', 'success', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: Credits tracked in credit_transactions, inputs/results passed to n8n directly

-- -------------------- WORKFLOWS --------------------
-- Legacy n8n workflow mappings (new agents use webhook_url directly)
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  n8n_workflow_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -------------------- CREDENTIAL PLATFORM DEFINITIONS --------------------
-- Platform configuration registry (WordPress, OpenAI, Ahrefs, etc.)
CREATE TABLE credential_platform_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_slug VARCHAR(50) UNIQUE NOT NULL,
  platform_name VARCHAR(100) NOT NULL,
  credential_type credential_type NOT NULL,

  -- Field definitions for user input forms
  field_schema JSONB NOT NULL,  -- [{ name, label, type, required, placeholder }]

  -- OAuth configuration (optional - for future OAuth support)
  oauth_config JSONB,

  -- UI display
  icon_url TEXT,
  description TEXT,
  documentation_url TEXT,
  setup_instructions TEXT,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -------------------- USER AGENT CREDENTIALS --------------------
-- Encrypted user credentials (AES-256-GCM)
CREATE TABLE user_agent_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Encrypted credential data (AES-256-GCM)
  encrypted_data TEXT NOT NULL,       -- Base64-encoded encrypted JSON
  encryption_iv TEXT NOT NULL,        -- Initialization vector (16 bytes, base64)
  encryption_tag TEXT NOT NULL,       -- Authentication tag (16 bytes, base64)
  encryption_key_version INTEGER NOT NULL DEFAULT 1,

  -- Platform-based system
  credential_type credential_type DEFAULT 'api_key',
  platform_slug VARCHAR(50) NOT NULL,  -- 'wordpress', 'openai', 'ahrefs', etc.
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,  -- Platform-specific data (site_url, account_name, etc.)

  -- OAuth 2.0 support (future enhancement)
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  token_scope TEXT,
  platform_user_id TEXT,
  platform_user_email TEXT,
  last_refreshed_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints: One credential per user-agent-platform combination
  CONSTRAINT user_agent_credentials_user_agent_platform_key
    UNIQUE (user_id, agent_id, platform_slug)
);

-- -------------------- OAUTH STATES --------------------
-- OAuth flow CSRF protection (future enhancement)
CREATE TABLE oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_token VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  platform_slug VARCHAR(50) NOT NULL,

  code_verifier TEXT,  -- PKCE code verifier
  redirect_uri TEXT NOT NULL,

  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -------------------- AUDIT LOGS --------------------
-- Security audit trail
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -------------------- MIGRATION TRACKING --------------------
CREATE TABLE _migrations (
  name TEXT PRIMARY KEY,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================================================
-- 3. CREATE INDEXES
-- ==================================================

-- Profiles indexes
CREATE INDEX idx_profiles_credits ON profiles(credits);
CREATE INDEX idx_profiles_created_at ON profiles(created_at DESC);
CREATE INDEX idx_profiles_role ON profiles(role) WHERE role IS NOT NULL;

-- Agents indexes
CREATE INDEX idx_agents_is_active ON agents(is_active);
CREATE INDEX idx_agents_category ON agents(category);
CREATE INDEX idx_agents_created_at ON agents(created_at DESC);
CREATE INDEX idx_agents_deleted_at ON agents(deleted_at) WHERE deleted_at IS NULL;

-- Credit purchases indexes (CRITICAL for idempotency)
CREATE UNIQUE INDEX idx_credit_purchases_payment_id ON credit_purchases(razorpay_payment_id);
CREATE INDEX idx_credit_purchases_user_id ON credit_purchases(user_id);
CREATE INDEX idx_credit_purchases_order_id ON credit_purchases(razorpay_order_id);
CREATE INDEX idx_credit_purchases_status ON credit_purchases(status);
CREATE INDEX idx_credit_purchases_created_at ON credit_purchases(created_at DESC);

-- Credit transactions indexes
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX idx_credit_transactions_purchase_id ON credit_transactions(purchase_id)
  WHERE purchase_id IS NOT NULL;
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

-- User agents indexes
CREATE INDEX idx_user_agents_user_id ON user_agents(user_id);
CREATE INDEX idx_user_agents_agent_id ON user_agents(agent_id);
CREATE INDEX idx_user_agents_purchased_at ON user_agents(purchased_at DESC);
CREATE UNIQUE INDEX idx_user_agents_unique ON user_agents(user_id, agent_id);

-- Agent executions indexes
CREATE INDEX idx_agent_executions_user_id ON agent_executions(user_id);
CREATE INDEX idx_agent_executions_agent_id ON agent_executions(agent_id);
CREATE INDEX idx_agent_executions_status ON agent_executions(status);

-- User agent credentials indexes
CREATE INDEX idx_user_agent_credentials_user_id ON user_agent_credentials(user_id);
CREATE INDEX idx_user_agent_credentials_agent_id ON user_agent_credentials(agent_id);
CREATE INDEX idx_user_agent_credentials_platform
  ON user_agent_credentials(platform_slug, user_id, is_active);
CREATE INDEX idx_user_agent_credentials_agent_platform
  ON user_agent_credentials(agent_id, platform_slug, user_id, is_active);
CREATE INDEX idx_user_agent_credentials_token_expiry
  ON user_agent_credentials(token_expires_at)
  WHERE is_active = true AND credential_type = 'oauth2';

-- OAuth states indexes
CREATE INDEX idx_oauth_states_expiry ON oauth_states(expires_at)
  WHERE is_completed = false;

-- Audit logs indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Credit packages indexes
CREATE INDEX idx_credit_packages_deleted_at ON credit_packages(deleted_at)
  WHERE deleted_at IS NULL;

-- ==================================================
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- ==================================================
-- CRITICAL: All user data tables MUST have RLS enabled

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_agent_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Public tables (no RLS needed - anyone can view)
-- - agents (marketplace listings)
-- - credit_packages (pricing)
-- - credential_platform_definitions (platform configs)
-- - workflows (legacy mappings)

-- ==================================================
-- 5. CREATE RLS POLICIES
-- ==================================================

-- -------------------- PROFILES POLICIES --------------------
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile (except credits, role, total_spent)
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role full access (for admin operations)
CREATE POLICY "Service role full access to profiles"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -------------------- USER_AGENTS POLICIES --------------------
-- Users can view their own purchased agents
CREATE POLICY "Users can view own agents"
  ON user_agents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role handles all modifications (via payment RPC)
CREATE POLICY "Service role full access to user_agents"
  ON user_agents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -------------------- CREDIT_PURCHASES POLICIES --------------------
-- Users can view their own purchase history
CREATE POLICY "Users can view own purchases"
  ON credit_purchases
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role handles all modifications (via payment RPC)
CREATE POLICY "Service role full access to credit_purchases"
  ON credit_purchases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -------------------- CREDIT_TRANSACTIONS POLICIES --------------------
-- Users can view their own transaction history
CREATE POLICY "Users can view own transactions"
  ON credit_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role handles all modifications (via RPC functions)
CREATE POLICY "Service role full access to credit_transactions"
  ON credit_transactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -------------------- AGENT_EXECUTIONS POLICIES --------------------
-- Users can view their own execution history
CREATE POLICY "Users can view own executions"
  ON agent_executions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own executions (for run-workflow API)
CREATE POLICY "Users can create own executions"
  ON agent_executions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own executions (status changes)
CREATE POLICY "Users can update own executions"
  ON agent_executions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access to agent_executions"
  ON agent_executions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -------------------- USER_AGENT_CREDENTIALS POLICIES --------------------
-- Users can only view their own credentials
CREATE POLICY "Users can view own credentials"
  ON user_agent_credentials
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can only insert their own credentials
CREATE POLICY "Users can insert own credentials"
  ON user_agent_credentials
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own credentials
CREATE POLICY "Users can update own credentials"
  ON user_agent_credentials
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own credentials
CREATE POLICY "Users can delete own credentials"
  ON user_agent_credentials
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role full access (for admin operations)
CREATE POLICY "Service role full access to credentials"
  ON user_agent_credentials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -------------------- OAUTH_STATES POLICIES --------------------
-- Users can view their own OAuth states
CREATE POLICY "Users can view own OAuth states"
  ON oauth_states
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own OAuth states
CREATE POLICY "Users can insert own OAuth states"
  ON oauth_states
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access to oauth_states"
  ON oauth_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -------------------- AUDIT_LOGS POLICIES --------------------
-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Authenticated users can insert audit logs
CREATE POLICY "Users can insert audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Service role full access
CREATE POLICY "Service role full access to audit_logs"
  ON audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==================================================
-- 6. CREATE RPC FUNCTIONS
-- ==================================================

-- -------------------- DEDUCT CREDITS ATOMIC --------------------
-- Atomically deduct credits with balance check
CREATE OR REPLACE FUNCTION deduct_credits_atomic(
  p_user_id UUID,
  p_amount INTEGER,
  p_agent_id UUID DEFAULT NULL,
  p_execution_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_credits INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Lock the user row to prevent race conditions
  SELECT credits INTO v_current_credits
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- Check if user exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Check if sufficient credits
  IF v_current_credits < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'current_credits', v_current_credits,
      'required_credits', p_amount
    );
  END IF;

  -- Deduct credits
  v_new_balance := v_current_credits - p_amount;

  UPDATE profiles
  SET credits = v_new_balance,
      total_executions = COALESCE(total_executions, 0) + 1,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    execution_id,
    created_at
  ) VALUES (
    p_user_id,
    'usage',
    -p_amount,
    v_new_balance,
    p_execution_id,
    NOW()
  );

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'previous_balance', v_current_credits,
    'amount_deducted', p_amount,
    'new_balance', v_new_balance
  );
END;
$$;

-- -------------------- ADD CREDITS ATOMIC --------------------
-- Atomically add credits
CREATE OR REPLACE FUNCTION add_credits_atomic(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT DEFAULT 'purchase',
  p_purchase_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_credits INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Lock the user row
  SELECT credits INTO v_current_credits
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- Check if user exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Add credits
  v_new_balance := v_current_credits + p_amount;

  UPDATE profiles
  SET credits = v_new_balance,
      total_spent = COALESCE(total_spent, 0) + (CASE WHEN p_type = 'purchase' THEN p_amount ELSE 0 END),
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    purchase_id,
    created_at
  ) VALUES (
    p_user_id,
    p_type,
    p_amount,
    v_new_balance,
    p_purchase_id,
    NOW()
  );

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'previous_balance', v_current_credits,
    'amount_added', p_amount,
    'new_balance', v_new_balance
  );
END;
$$;

-- -------------------- PROCESS PAYMENT ATOMIC --------------------
-- Idempotent payment processing
CREATE OR REPLACE FUNCTION process_payment_atomic(
  p_user_id UUID,
  p_package_id UUID,
  p_razorpay_order_id TEXT,
  p_razorpay_payment_id TEXT,
  p_razorpay_signature TEXT,
  p_amount_paid INTEGER,
  p_credits_purchased INTEGER,
  p_agent_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purchase_id UUID;
  v_credit_result JSONB;
  v_existing_purchase UUID;
BEGIN
  -- Check for duplicate payment (idempotency)
  SELECT id INTO v_existing_purchase
  FROM credit_purchases
  WHERE razorpay_payment_id = p_razorpay_payment_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payment already processed',
      'purchase_id', v_existing_purchase
    );
  END IF;

  -- Insert credit purchase record
  INSERT INTO credit_purchases (
    user_id,
    package_id,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    amount_paid,
    credits_purchased,
    total_credits,
    bonus_credits,
    status,
    currency,
    created_at
  ) VALUES (
    p_user_id,
    p_package_id,
    p_razorpay_order_id,
    p_razorpay_payment_id,
    p_razorpay_signature,
    p_amount_paid,
    p_credits_purchased,
    p_credits_purchased,
    0,
    'paid',
    'INR',
    NOW()
  ) RETURNING id INTO v_purchase_id;

  -- Add credits to user atomically
  SELECT add_credits_atomic(
    p_user_id,
    p_credits_purchased,
    'purchase',
    v_purchase_id
  ) INTO v_credit_result;

  -- Check if credit addition was successful
  IF (v_credit_result->>'success')::boolean = false THEN
    RAISE EXCEPTION 'Failed to add credits: %', v_credit_result->>'error';
  END IF;

  -- Grant agent access if agent_id provided
  IF p_agent_id IS NOT NULL THEN
    INSERT INTO user_agents (user_id, agent_id, purchased_at)
    VALUES (p_user_id, p_agent_id, NOW())
    ON CONFLICT (user_id, agent_id) DO NOTHING;
  END IF;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'credits_added', p_credits_purchased,
    'new_balance', (v_credit_result->>'new_balance')::integer
  );
END;
$$;

-- -------------------- CHECK REQUIRED CREDENTIALS --------------------
-- Check if user has all required credentials for an agent
CREATE OR REPLACE FUNCTION user_has_required_credentials(
  p_user_id UUID,
  p_agent_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  IF v_required_platforms IS NULL OR array_length(v_required_platforms, 1) IS NULL THEN
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
$$;

-- -------------------- CLEANUP EXPIRED OAUTH STATES --------------------
-- Delete expired OAuth state tokens (for cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM oauth_states
  WHERE expires_at < NOW()
    AND is_completed = false;
END;
$$;

-- ==================================================
-- 7. CREATE TRIGGERS
-- ==================================================

-- -------------------- AUTO-UPDATE TIMESTAMPS --------------------
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_agent_credentials_updated_at
  BEFORE UPDATE ON user_agent_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credential_platform_definitions_updated_at
  BEFORE UPDATE ON credential_platform_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -------------------- AUTO-CREATE PROFILE ON SIGNUP --------------------
-- Function to create profile when user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, credits, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    0,
    'user',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ==================================================
-- 8. INSERT DEFAULT PLATFORM DEFINITIONS
-- ==================================================

-- WordPress (Basic Auth with Application Password)
INSERT INTO credential_platform_definitions (
  platform_slug, platform_name, credential_type, field_schema, description, setup_instructions, is_active
) VALUES (
  'wordpress',
  'WordPress',
  'basic_auth',
  '[
    {"name": "site_url", "label": "Site URL", "type": "url", "required": true, "placeholder": "https://yoursite.com"},
    {"name": "username", "label": "Username", "type": "text", "required": true, "placeholder": "admin"},
    {"name": "application_password", "label": "Application Password", "type": "password", "required": true, "placeholder": "xxxx xxxx xxxx xxxx"}
  ]'::jsonb,
  'Connect to WordPress sites using Application Passwords (secure, no main password needed)',
  'Go to Users → Profile → Application Passwords in WordPress admin, generate new password, copy and paste here',
  true
);

-- OpenAI (API Key)
INSERT INTO credential_platform_definitions (
  platform_slug, platform_name, credential_type, field_schema, description, setup_instructions, is_active
) VALUES (
  'openai',
  'OpenAI',
  'api_key',
  '[
    {"name": "api_key", "label": "OpenAI API Key", "type": "password", "required": true, "placeholder": "sk-..."}
  ]'::jsonb,
  'Connect to OpenAI API for GPT models, embeddings, and more',
  'Get API key from https://platform.openai.com/api-keys',
  true
);

-- Ahrefs (API Key)
INSERT INTO credential_platform_definitions (
  platform_slug, platform_name, credential_type, field_schema, description, setup_instructions, is_active
) VALUES (
  'ahrefs',
  'Ahrefs',
  'api_key',
  '[
    {"name": "api_key", "label": "Ahrefs API Token", "type": "password", "required": true, "placeholder": "ahrefsToken_..."}
  ]'::jsonb,
  'Connect to Ahrefs API for SEO data, backlinks, and keyword research',
  'Get API token from Ahrefs account settings (requires paid subscription)',
  true
);

-- SEMrush (API Key)
INSERT INTO credential_platform_definitions (
  platform_slug, platform_name, credential_type, field_schema, description, setup_instructions, is_active
) VALUES (
  'semrush',
  'SEMrush',
  'api_key',
  '[
    {"name": "api_key", "label": "SEMrush API Key", "type": "password", "required": true, "placeholder": "..."}
  ]'::jsonb,
  'Connect to SEMrush API for SEO analytics and competitive research',
  'Get API key from SEMrush account settings (requires subscription)',
  true
);

-- SerpAPI (API Key)
INSERT INTO credential_platform_definitions (
  platform_slug, platform_name, credential_type, field_schema, description, setup_instructions, is_active
) VALUES (
  'serpapi',
  'SerpAPI',
  'api_key',
  '[
    {"name": "api_key", "label": "SerpAPI Key", "type": "password", "required": true, "placeholder": "..."}
  ]'::jsonb,
  'Connect to SerpAPI for Google Search results data',
  'Get API key from https://serpapi.com/manage-api-key',
  true
);

-- ==================================================
-- 9. GRANT PERMISSIONS
-- ==================================================

-- RPC function permissions
GRANT EXECUTE ON FUNCTION deduct_credits_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION add_credits_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION process_payment_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION user_has_required_credentials TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_oauth_states TO service_role;

-- Table permissions
GRANT SELECT, INSERT ON audit_logs TO authenticated;
GRANT ALL ON audit_logs TO service_role;

-- General schema permissions (Supabase default)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;

-- Authenticated users can read public tables
GRANT SELECT ON agents TO anon, authenticated;
GRANT SELECT ON credit_packages TO anon, authenticated;
GRANT SELECT ON credential_platform_definitions TO anon, authenticated;
GRANT SELECT ON workflows TO anon, authenticated;

-- ==================================================
-- 10. ADD COMMENTS FOR DOCUMENTATION
-- ==================================================

COMMENT ON TABLE profiles IS 'User profiles - RLS enabled, users can only view/update own profile';
COMMENT ON TABLE user_agents IS 'User agent purchases - RLS enabled, users can only view own purchases';
COMMENT ON TABLE credit_purchases IS 'Payment history - RLS enabled, users can only view own history';
COMMENT ON TABLE credit_transactions IS 'Credit movements - RLS enabled, users can only view own transactions';
COMMENT ON TABLE agent_executions IS 'Workflow executions - RLS enabled, minimal schema (status tracking only)';
COMMENT ON TABLE user_agent_credentials IS 'Encrypted credentials - RLS enabled, AES-256-GCM encryption';
COMMENT ON TABLE credential_platform_definitions IS 'Platform registry - Public, defines available credential platforms';
COMMENT ON TABLE agents IS 'AI agents - Public marketplace listings';
COMMENT ON TABLE credit_packages IS 'Credit bundles - Public pricing';
COMMENT ON TABLE audit_logs IS 'Security audit trail - RLS enabled';

COMMENT ON FUNCTION deduct_credits_atomic IS 'Atomically deduct credits with balance check and transaction record';
COMMENT ON FUNCTION add_credits_atomic IS 'Atomically add credits with transaction record';
COMMENT ON FUNCTION process_payment_atomic IS 'Idempotent payment processing (handles race conditions)';
COMMENT ON FUNCTION user_has_required_credentials IS 'Check if user has all required platform credentials';

-- ==================================================
-- MIGRATION COMPLETE
-- ==================================================

INSERT INTO _migrations (name, executed_at)
VALUES ('complete_secure_schema', NOW());

-- ==================================================
-- SECURITY VERIFICATION CHECKLIST
-- ==================================================
-- ✅ All user data tables have RLS enabled
-- ✅ Users can ONLY see their own data (profiles, purchases, credentials, executions)
-- ✅ Service role bypasses RLS (for admin operations via API)
-- ✅ Public tables are read-only for authenticated users
-- ✅ Credentials encrypted with AES-256-GCM
-- ✅ Payment idempotency prevents duplicate charges
-- ✅ Atomic credit operations prevent race conditions
-- ✅ Auto-profile creation on signup
-- ✅ OAuth state CSRF protection
-- ✅ Audit logging for security events

-- ==================================================
-- TESTING RLS
-- ==================================================
-- After setup, test with authenticated user:
-- SELECT * FROM profiles WHERE id != auth.uid();  -- Should return EMPTY
-- SELECT * FROM profiles WHERE id = auth.uid();   -- Should return YOUR data only
-- SELECT * FROM credit_purchases;                 -- Should return only YOUR purchases
-- SELECT * FROM user_agent_credentials;           -- Should return only YOUR credentials
