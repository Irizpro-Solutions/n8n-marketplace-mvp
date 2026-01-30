# OAuth 2.0 + Credential Vault Implementation Guide

## Overview

This guide explains how to implement OAuth 2.0 authentication and secure credential management for your n8n marketplace agents. The system supports:

- **OAuth 2.0** (Google, WordPress, etc.)
- **API Keys** (OpenAI, Ahrefs, etc.)
- **Basic Auth** (Legacy systems)
- **Token Refresh** (Automatic)
- **Multi-Account Support** (Coming soon)

---

## Architecture Overview

```
┌─────────────┐
│   USER      │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. "Connect WordPress"
       ▼
┌─────────────────────────────────┐
│  YOUR PLATFORM                  │
│  /api/oauth/initiate            │
└──────┬──────────────────────────┘
       │
       │ 2. Redirect to OAuth Provider
       ▼
┌─────────────────────────────────┐
│  OAUTH PROVIDER                 │
│  (Google, WordPress, etc.)      │
└──────┬──────────────────────────┘
       │
       │ 3. User grants permission
       ▼
┌─────────────────────────────────┐
│  YOUR PLATFORM                  │
│  /api/oauth/callback            │
│  - Exchange code for tokens     │
│  - Store encrypted in DB        │
└──────┬──────────────────────────┘
       │
       │ 4. Workflow execution
       ▼
┌─────────────────────────────────┐
│  WORKFLOW EXECUTION             │
│  - Retrieve credentials         │
│  - Check if expired             │
│  - Refresh if needed            │
│  - Inject into n8n payload      │
└──────┬──────────────────────────┘
       │
       │ 5. Credentials passed
       ▼
┌─────────────────────────────────┐
│  n8n WEBHOOK                    │
│  - Receives workflow inputs     │
│  - Receives credentials object  │
│  - Executes workflow            │
└─────────────────────────────────┘
```

---

## Database Setup

### Step 1: Run Migration

```bash
# Apply the OAuth credential system migration
psql your_database < supabase/migrations/20260128_oauth_credential_system.sql
```

This creates:
- `credential_type` enum
- Enhanced `user_agent_credentials` table with OAuth support
- `credential_field_definitions` table (platform registry)
- `oauth_states` table (CSRF protection)

### Step 2: Verify Tables

```sql
-- Check enhanced user_agent_credentials table
\d user_agent_credentials

-- Should have columns:
-- - credential_type (enum)
-- - platform_slug (varchar)
-- - access_token_encrypted (text)
-- - refresh_token_encrypted (text)
-- - token_expires_at (timestamp)
-- - is_active (boolean)
```

---

## Environment Variables Setup

### Step 1: Generate Encryption Key

```bash
# Generate 256-bit encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 2: Configure OAuth Providers

Add to `.env.local`:

```bash
# Credential Encryption (REQUIRED)
CREDENTIAL_ENCRYPTION_KEY=<your-64-character-hex-key>

# WordPress OAuth
WORDPRESS_CLIENT_ID=<your-wordpress-client-id>
WORDPRESS_CLIENT_SECRET=<your-wordpress-client-secret>

# Google OAuth (for Search Console, Analytics, etc.)
GOOGLE_CLIENT_ID=<your-google-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

### Step 3: Register OAuth Apps

#### WordPress OAuth
1. Go to https://developer.wordpress.com/apps/
2. Create new application
3. Set redirect URI: `https://yourdomain.com/api/oauth/callback`
4. Copy Client ID and Secret

#### Google OAuth
1. Go to https://console.cloud.google.com/
2. Create new project or select existing
3. Enable APIs: Google Search Console API, Google Analytics API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `https://yourdomain.com/api/oauth/callback`
6. Copy Client ID and Secret

---

## How It Works

### 1. Admin Defines Required Credentials

```typescript
// In admin panel, when creating/editing agent
const agent = {
  name: "SEO Content Writer",
  required_platforms: [
    "wordpress_oauth",  // OAuth for WordPress publishing
    "openai",           // API key for content generation
    "ahrefs"            // API key for SEO data
  ]
}
```

### 2. User Connects Platforms

When user purchases agent, they see connection UI:

```
┌────────────────────────────────────────┐
│ 🔐 Configure Credentials               │
│                                        │
│ This agent requires:                   │
│                                        │
│ ☐ WordPress (OAuth)                    │
│   [Connect WordPress Account]          │
│                                        │
│ ☐ OpenAI (API Key)                     │
│   [Enter API Key]                      │
│                                        │
│ ☐ Ahrefs (API Key)                     │
│   [Enter API Token]                    │
│                                        │
│ [Save All Credentials]                 │
└────────────────────────────────────────┘
```

### 3. OAuth Flow (For OAuth Platforms)

```typescript
// User clicks "Connect WordPress Account"

// 1. Frontend calls initiate endpoint
const response = await fetch('/api/oauth/initiate', {
  method: 'POST',
  body: JSON.stringify({
    agentId: 'agent_123',
    platformSlug: 'wordpress_oauth'
  })
});

const { authorization_url } = await response.json();

// 2. Redirect user to OAuth provider
window.location.href = authorization_url;
// User lands on WordPress.com authorization page

// 3. User grants permission

// 4. WordPress redirects to: /api/oauth/callback?code=...&state=...

// 5. Callback handler:
// - Validates state (CSRF protection)
// - Exchanges code for tokens
// - Stores encrypted tokens in database
// - Redirects to dashboard with success message
```

### 4. API Key Storage (For Non-OAuth Platforms)

```typescript
// User enters OpenAI API key in form

// Frontend calls save endpoint
await fetch('/api/credentials/save', {
  method: 'POST',
  body: JSON.stringify({
    agentId: 'agent_123',
    platformSlug: 'openai',
    credentialType: 'api_key',
    credentials: {
      api_key: 'sk-...'
    }
  })
});

// Backend encrypts and stores in user_agent_credentials table
```

### 5. Workflow Execution with Credentials

```typescript
// When user runs workflow

// 1. Retrieve all credentials for agent
const credentials = await retrieveAllAgentCredentials(userId, agentId);
// Returns:
// {
//   "wordpress_oauth": {
//     type: "oauth2",
//     access_token: "decrypted-token",
//     refresh_token: "decrypted-refresh",
//     expires_at: Date
//   },
//   "openai": {
//     type: "api_key",
//     data: { api_key: "sk-..." }
//   },
//   "ahrefs": {
//     type: "api_key",
//     data: { api_token: "token_..." }
//   }
// }

// 2. Check if OAuth tokens need refresh
for (const [platform, cred] of Object.entries(credentials)) {
  if (needsRefresh(cred)) {
    await refreshOAuthToken(userId, agentId, platform, platformConfig);
  }
}

// 3. Build n8n webhook payload
const payload = {
  // User inputs
  inputs: {
    targetKeyword: "best headphones 2024",
    blogTone: "professional"
  },

  // User context
  user: {
    id: userId,
    email: userEmail
  },

  // Injected credentials
  credentials: {
    wordpress: {
      access_token: credentials.wordpress_oauth.access_token,
      site_url: "https://user-blog.com"
    },
    openai: {
      api_key: credentials.openai.data.api_key
    },
    ahrefs: {
      api_token: credentials.ahrefs.data.api_token
    }
  }
};

// 4. Call n8n webhook
await callN8nWorkflow(workflowId, payload);
```

### 6. n8n Workflow Accesses Credentials

Inside n8n workflow:

```javascript
// HTTP Request Node - WordPress API
URL: https://user-blog.com/wp-json/wp/v2/posts
Authentication: Bearer Token
Token: {{ $json.credentials.wordpress.access_token }}

// HTTP Request Node - OpenAI
URL: https://api.openai.com/v1/chat/completions
Headers:
  Authorization: Bearer {{ $json.credentials.openai.api_key }}

// HTTP Request Node - Ahrefs
URL: https://api.ahrefs.com/v3/keywords
Query Parameters:
  token: {{ $json.credentials.ahrefs.api_token }}
```

---

## Token Refresh System

### Automatic Refresh (Recommended)

```typescript
// In workflow execution route
const credentials = await retrieveAllAgentCredentials(userId, agentId);

for (const [platform, cred] of Object.entries(credentials)) {
  if (cred.type === 'oauth2' && needsRefresh(cred)) {
    // Token expires in < 5 minutes, refresh it
    const platformConfig = getPlatformConfig(platform);
    await refreshOAuthToken(userId, agentId, platform, platformConfig);
  }
}
```

### Background Refresh (Optional, Production)

```typescript
// Cron job: runs every 5 minutes
// Finds tokens expiring in next 10 minutes

const { data: expiringCredentials } = await supabase
  .from('user_agent_credentials')
  .select('*')
  .eq('credential_type', 'oauth2')
  .eq('is_active', true)
  .lt('token_expires_at', new Date(Date.now() + 10 * 60 * 1000).toISOString())
  .gt('token_expires_at', new Date().toISOString());

for (const cred of expiringCredentials) {
  try {
    await refreshOAuthToken(
      cred.user_id,
      cred.agent_id,
      cred.platform_slug,
      getPlatformConfig(cred.platform_slug)
    );
  } catch (error) {
    console.error('Token refresh failed:', error);
    // Notify user to reconnect
  }
}
```

---

## Security Best Practices

### ✅ DO

1. **Always encrypt credentials** using AES-256-GCM
2. **Use PKCE** for OAuth flows (code_challenge/code_verifier)
3. **Validate state tokens** to prevent CSRF attacks
4. **Set token expiry** and auto-refresh before expiration
5. **Use RLS policies** to isolate user credentials
6. **Never log tokens** in production
7. **Allow users to disconnect** and revoke access
8. **Rotate encryption keys** periodically (with migration plan)

### ❌ DON'T

1. **Never store plaintext credentials** in database
2. **Don't skip state validation** in OAuth callback
3. **Don't expose refresh tokens** to frontend
4. **Don't reuse state tokens** - generate new for each flow
5. **Don't store credentials in n8n** - always inject dynamically
6. **Don't forget to handle token expiry** gracefully

---

## Testing

### Test OAuth Flow

```bash
# 1. Start development server
npm run dev

# 2. Create test agent with OAuth requirement
# In admin panel: required_platforms = ["wordpress_oauth"]

# 3. Purchase agent as test user

# 4. Click "Connect WordPress"
# Should redirect to WordPress.com

# 5. Grant permission
# Should redirect back with success message

# 6. Verify credentials stored
# Check user_agent_credentials table

# 7. Run workflow
# Should execute successfully with credentials
```

### Test Token Refresh

```typescript
// Manually set token to expire soon
await supabase
  .from('user_agent_credentials')
  .update({ token_expires_at: new Date(Date.now() + 2 * 60 * 1000) })
  .eq('user_id', userId)
  .eq('platform_slug', 'wordpress_oauth');

// Wait 3 minutes

// Run workflow - should auto-refresh token
await fetch('/api/run-workflow', {
  method: 'POST',
  body: JSON.stringify({ agentId, inputs: {} })
});

// Check last_refreshed_at - should be updated
```

---

## Adding New OAuth Providers

### Step 1: Add Provider Config

```typescript
// src/app/api/oauth/initiate/route.ts
const OAUTH_PROVIDERS = {
  // ... existing providers

  linkedin: {
    auth_url: 'https://www.linkedin.com/oauth/v2/authorization',
    scope: 'r_liteprofile r_emailaddress',
    client_id_env: 'LINKEDIN_CLIENT_ID',
    response_type: 'code',
  },
};

// src/app/api/oauth/callback/route.ts
const TOKEN_CONFIGS = {
  // ... existing configs

  linkedin: {
    token_url: 'https://www.linkedin.com/oauth/v2/accessToken',
    client_id_env: 'LINKEDIN_CLIENT_ID',
    client_secret_env: 'LINKEDIN_CLIENT_SECRET',
    grant_type: 'authorization_code',
  },
};
```

### Step 2: Add to Database

```sql
INSERT INTO credential_field_definitions (
  platform_slug,
  platform_name,
  credential_type,
  oauth_config
) VALUES (
  'linkedin',
  'LinkedIn',
  'oauth2',
  '{"auth_url": "https://www.linkedin.com/oauth/v2/authorization", "token_url": "https://www.linkedin.com/oauth/v2/accessToken", "scope": "r_liteprofile r_emailaddress", "provider": "linkedin"}'
);
```

### Step 3: Register OAuth App

1. Go to https://www.linkedin.com/developers/apps
2. Create new app
3. Add redirect URI: `https://yourdomain.com/api/oauth/callback`
4. Add credentials to `.env.local`:

```bash
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
```

### Step 4: Use in Agent

```typescript
// Admin panel
const agent = {
  name: "LinkedIn Post Generator",
  required_platforms: ["linkedin", "openai"]
};
```

---

## Troubleshooting

### OAuth Flow Fails

**Symptom:** User clicks "Connect" but gets error

**Check:**
1. Environment variables set correctly
2. OAuth app configured with correct redirect URI
3. State token not expired (< 10 minutes)
4. Check browser console for errors

### Token Refresh Fails

**Symptom:** Workflow fails with "Invalid credentials"

**Check:**
1. Refresh token still valid (some expire after 90 days)
2. OAuth app credentials correct
3. Check `last_refreshed_at` timestamp
4. User may need to reconnect

### Credentials Not Found

**Symptom:** Workflow executes but credentials not injected

**Check:**
1. User has connected required platforms
2. Credentials marked as `is_active = true`
3. Agent's `required_platforms` matches stored `platform_slug`
4. Check `user_agent_credentials` table

---

## Migration from Old System

If you have existing simple credential system:

```sql
-- Migrate existing credentials to new schema
-- Assumes old system used credential_fields

-- For API keys (no OAuth)
UPDATE user_agent_credentials
SET
  credential_type = 'api_key',
  platform_slug = 'openai',  -- Adjust per credential
  is_active = true
WHERE encrypted_data IS NOT NULL;

-- For OAuth credentials added manually
-- Re-authenticate users via OAuth flow (can't migrate tokens)
```

---

## Production Checklist

- [ ] Run database migration
- [ ] Set `CREDENTIAL_ENCRYPTION_KEY` (64 hex chars)
- [ ] Configure OAuth providers (WordPress, Google, etc.)
- [ ] Register OAuth apps with production redirect URIs
- [ ] Test OAuth flow end-to-end
- [ ] Test token refresh mechanism
- [ ] Implement background token refresh job
- [ ] Add monitoring for failed token refreshes
- [ ] Document credential requirements in agent descriptions
- [ ] Add user-facing credential management UI
- [ ] Test credential disconnect/revoke flow
- [ ] Set up alerts for encryption key rotation
- [ ] Review RLS policies for security
- [ ] Enable audit logging for credential access
- [ ] Test with real OAuth providers (not just dev keys)

---

## Support & Resources

- **OAuth 2.0 Spec:** https://oauth.net/2/
- **PKCE RFC:** https://tools.ietf.org/html/rfc7636
- **Google OAuth:** https://developers.google.com/identity/protocols/oauth2
- **WordPress OAuth:** https://developer.wordpress.com/docs/oauth2/

---

## FAQ

**Q: Can users have multiple accounts for same platform?**
A: Not yet. Current system supports one credential per user-agent-platform. Multi-account support coming soon.

**Q: What happens if user disconnects credential?**
A: Credential marked as `is_active = false`. Workflow execution will fail with clear error message prompting reconnection.

**Q: How long do refresh tokens last?**
A: Varies by provider:
- Google: 6 months (with use)
- WordPress: No expiry
- Others: Check provider docs

**Q: Can I use this for non-OAuth APIs?**
A: Yes! System supports:
- OAuth 2.0 (preferred)
- API keys (OpenAI, Ahrefs, etc.)
- Basic auth (username + password)
- Bearer tokens

**Q: Is this GDPR compliant?**
A: Credentials are encrypted at rest. Users can disconnect anytime. Ensure your privacy policy covers credential storage. Consult legal advisor for compliance.

**Q: What if encryption key is compromised?**
A:
1. Generate new key
2. Decrypt all credentials with old key
3. Re-encrypt with new key
4. Update environment variable
5. Optionally: Force users to reconnect for extra security

---

## Conclusion

You now have a production-ready OAuth 2.0 + Credential Vault system that:

✅ Supports OAuth, API keys, and basic auth
✅ Encrypts credentials with AES-256-GCM
✅ Auto-refreshes OAuth tokens
✅ Injects credentials dynamically into n8n workflows
✅ Provides user control (connect/disconnect)
✅ Scales to multi-tenant SaaS

This is the industry-standard approach used by Zapier, Make.com, and other workflow automation platforms.
