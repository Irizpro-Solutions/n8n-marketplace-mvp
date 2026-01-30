# Simple Credential System - Implementation Guide (Option A)

## 🎯 What This Does

This implements a **simple, platform-based credential system** WITHOUT OAuth complexity. Perfect for collecting WordPress credentials, API keys, etc.

---

## 📦 What Was Created

### 1. Database Migration
```
✅ supabase/migrations/20260128_simple_credential_system.sql
```
- Enhances `user_agent_credentials` table with platform support
- Creates `credential_platform_definitions` table with 5 pre-configured platforms:
  - WordPress (application password)
  - OpenAI (API key)
  - Ahrefs (API token)
  - SEMrush (API key)
  - SerpAPI (API key)
- Adds `required_platforms` to `agents` table
- Creates helper function `user_has_required_credentials()`

### 2. Credential Manager
```
✅ src/lib/credential-manager.ts
```
Simple functions for platform-based credentials:
- `storePlatformCredentials()` - Save credentials for a platform
- `retrievePlatformCredentials()` - Get credentials for specific platform
- `retrieveAllAgentCredentials()` - Get all credentials (grouped by platform)
- `hasPlatformCredentials()` - Check if user has credentials
- `hasAllRequiredCredentials()` - Check if all required platforms are connected
- `getPlatformDefinition()` - Get field schema for a platform

### 3. Updated API Routes
```
✅ src/app/api/credentials/save/route.ts - Platform-based credential storage
✅ src/app/api/run-workflow/route.ts - Passes credentials to n8n properly
```

---

## 🚀 Quick Setup (15 Minutes)

### Step 1: Run Database Migration (5 min)

```bash
# Go to Supabase Dashboard → SQL Editor → New Query
# Copy-paste the entire file:
supabase/migrations/20260128_simple_credential_system.sql

# Click "RUN"

# Verify:
SELECT * FROM credential_platform_definitions;
# Should show 5 platforms: wordpress, openai, ahrefs, semrush, serpapi
```

### Step 2: Update Agent Configuration (2 min)

```sql
-- In Supabase SQL Editor:
-- Tell agent which platforms it needs

UPDATE agents
SET required_platforms = ARRAY['wordpress', 'openai']
WHERE id = 'your-seo-blog-agent-id';

-- Example: Agent needs WordPress + OpenAI + Ahrefs
UPDATE agents
SET required_platforms = ARRAY['wordpress', 'openai', 'ahrefs']
WHERE id = 'your-agent-id';
```

### Step 3: Test the System (8 min)

```bash
# 1. Start dev server
npm run dev

# 2. Test credential storage API:
curl -X POST http://localhost:3000/api/credentials/save \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "your-agent-id",
    "platformSlug": "wordpress",
    "credentials": {
      "site_url": "https://yoursite.com",
      "username": "admin",
      "application_password": "xxxx xxxx xxxx xxxx"
    },
    "metadata": {
      "account_name": "My Blog"
    }
  }'

# Should return:
# {"success": true, "message": "WordPress credentials saved successfully"}

# 3. Verify in database:
SELECT * FROM user_agent_credentials
WHERE platform_slug = 'wordpress';
```

---

## 📋 How It Works

### User Flow

```
1️⃣ User purchases agent
   └─> Agent has: required_platforms = ['wordpress', 'openai']

2️⃣ User needs to provide credentials
   └─> For each platform:
       - WordPress: URL, username, app password
       - OpenAI: API key

3️⃣ User fills credential form
   └─> Frontend calls /api/credentials/save
       {
         "agentId": "abc",
         "platformSlug": "wordpress",
         "credentials": { site_url, username, application_password }
       }

4️⃣ Credentials encrypted & stored
   └─> Database: user_agent_credentials table
       - Grouped by platform_slug
       - Each platform can have different fields

5️⃣ User runs workflow
   └─> Backend:
       - Retrieves all credentials for agent
       - Decrypts
       - Formats for n8n
       - Sends to n8n webhook

6️⃣ n8n workflow receives:
   {
     "inputs": { topic: "...", tone: "..." },
     "user": { id: "...", email: "..." },
     "credentials": {
       "wordpress": {
         "site_url": "https://user-site.com",
         "username": "admin",
         "application_password": "xxxx xxxx xxxx xxxx"
       },
       "openai": {
         "api_key": "sk-..."
       }
     }
   }

7️⃣ n8n workflow uses credentials:
   HTTP Request Node:
   URL: {{ $json.credentials.wordpress.site_url }}/wp-json/wp/v2/posts
   Auth: Basic
     Username: {{ $json.credentials.wordpress.username }}
     Password: {{ $json.credentials.wordpress.application_password }}
```

---

## 🔧 n8n Workflow Setup

### Old Way (Won't Work for Multiple Users)

```
WordPress Node:
  Credential: "WordPress account 2" (hardcoded)
  ❌ All users use YOUR WordPress account
  ❌ Not suitable for marketplace
```

### New Way (Works for Multiple Users)

```
HTTP Request Node:
  URL: {{ $json.credentials.wordpress.site_url }}/wp-json/wp/v2/posts
  Method: POST
  Authentication: Basic Auth
    Username: {{ $json.credentials.wordpress.username }}
    Password: {{ $json.credentials.wordpress.application_password }}
  Body:
  {
    "title": "{{ $json.inputs.title }}",
    "content": "{{ $json.inputs.content }}",
    "status": "publish"
  }

  ✅ Each user uses THEIR WordPress account
  ✅ Perfect for marketplace
```

### For OpenAI

```
HTTP Request Node:
  URL: https://api.openai.com/v1/chat/completions
  Method: POST
  Headers:
    Authorization: Bearer {{ $json.credentials.openai.api_key }}
  Body:
  {
    "model": "gpt-4",
    "messages": [
      {
        "role": "user",
        "content": "{{ $json.inputs.prompt }}"
      }
    ]
  }
```

---

## 📝 API Reference

### Store Credentials

```typescript
POST /api/credentials/save

Headers:
  Authorization: Bearer <user-token>

Body:
{
  "agentId": "agent_abc123",
  "platformSlug": "wordpress",  // or "openai", "ahrefs", etc.
  "credentials": {
    // For WordPress:
    "site_url": "https://mysite.com",
    "username": "admin",
    "application_password": "xxxx xxxx xxxx xxxx"

    // For OpenAI:
    "api_key": "sk-..."

    // For Ahrefs:
    "api_token": "token_..."
  },
  "metadata": {  // Optional
    "account_name": "My Blog",
    "site_url": "https://mysite.com"
  }
}

Response:
{
  "success": true,
  "message": "WordPress credentials saved successfully",
  "platform": "wordpress"
}
```

### Retrieve Credentials (Internal)

```typescript
// In your backend code:
import { retrieveAllAgentCredentials } from '@/lib/credential-manager';

const credentials = await retrieveAllAgentCredentials(userId, agentId);

// Returns:
{
  "wordpress": {
    "platform": "wordpress",
    "type": "basic_auth",
    "credentials": {
      "site_url": "https://mysite.com",
      "username": "admin",
      "application_password": "xxxx xxxx xxxx xxxx"
    },
    "metadata": { "account_name": "My Blog" }
  },
  "openai": {
    "platform": "openai",
    "type": "api_key",
    "credentials": {
      "api_key": "sk-..."
    }
  }
}
```

---

## 🎨 Frontend Form Example

```typescript
// User credential form (you'll build this)
const [credentials, setCredentials] = useState({
  site_url: '',
  username: '',
  application_password: ''
});

const handleSave = async () => {
  const response = await fetch('/api/credentials/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: 'agent_abc123',
      platformSlug: 'wordpress',
      credentials: credentials,
      metadata: {
        account_name: credentials.site_url.replace('https://', '')
      }
    })
  });

  if (response.ok) {
    alert('WordPress credentials saved!');
  }
};

return (
  <form>
    <input
      type="url"
      placeholder="https://yoursite.com"
      value={credentials.site_url}
      onChange={(e) => setCredentials({ ...credentials, site_url: e.target.value })}
    />
    <input
      type="text"
      placeholder="Username"
      value={credentials.username}
      onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
    />
    <input
      type="password"
      placeholder="Application Password"
      value={credentials.application_password}
      onChange={(e) => setCredentials({ ...credentials, application_password: e.target.value })}
    />
    <button onClick={handleSave}>Save WordPress Credentials</button>
  </form>
);
```

---

## 🔐 Security Notes

### What's Encrypted

✅ **Credentials** - All credential values (passwords, API keys, etc.)
✅ **Stored as AES-256-GCM** - Industry-standard encryption
✅ **Per-user isolation** - RLS policies ensure users only see their own
✅ **Metadata NOT encrypted** - Site URLs, account names (not sensitive)

### What's NOT Needed

❌ **OAuth credentials in .env.local** - Not needed for this approach!
❌ **Registering apps** - Not needed!
❌ **Token refresh** - Not needed for API keys/app passwords!

---

## ✅ Checklist

### Setup
- [ ] Run database migration
- [ ] Update agent `required_platforms` in database
- [ ] Verify encryption key in .env.local: `CREDENTIAL_ENCRYPTION_KEY`

### n8n Workflow
- [ ] Replace WordPress node with HTTP Request node
- [ ] Use expressions: `{{ $json.credentials.wordpress.site_url }}`
- [ ] Test workflow with credentials

### Frontend (You'll Build)
- [ ] Create credential input form for each platform
- [ ] Call `/api/credentials/save` API
- [ ] Show "Connected" status when credentials exist
- [ ] Allow users to disconnect/update credentials

### Testing
- [ ] Save WordPress credentials via API
- [ ] Verify encrypted in database
- [ ] Run workflow
- [ ] Verify workflow receives correct credentials
- [ ] Verify WordPress post created on user's site

---

## 🎯 Next Steps

### Phase 1: Basic Implementation (This Week)
1. ✅ Run database migration
2. ✅ Update agent configuration
3. ✅ Build credential input forms
4. ✅ Update n8n workflow to use HTTP Request nodes
5. ✅ Test end-to-end

### Phase 2: UI Improvements (Next Week)
- Add credential status indicators
- Show which platforms are connected
- Add "Disconnect" button
- Improve error messages
- Add setup instructions per platform

### Phase 3: More Platforms (Future)
- Add more platform definitions as needed
- Support custom platforms
- Add credential validation (test API keys work)

---

## 🆘 Troubleshooting

### Credentials Not Passed to n8n

**Check:**
```javascript
// In n8n workflow, add a "Set" node to debug:
{{ JSON.stringify($json) }}

// Should see:
{
  "inputs": {...},
  "user": {...},
  "credentials": {
    "wordpress": {...},
    "openai": {...}
  }
}
```

### Workflow Fails with "Unauthorized"

**Check:**
- WordPress application password is correct
- WordPress site URL is correct (include https://)
- Username is correct (usually "admin")
- WordPress REST API is enabled

### Database Query Fails

**Check:**
```sql
-- Verify credentials stored:
SELECT
  platform_slug,
  credential_type,
  is_active,
  metadata
FROM user_agent_credentials
WHERE user_id = 'your-user-id'
  AND agent_id = 'your-agent-id';
```

---

## 📞 Summary

**You Now Have:**
✅ Platform-based credential system (WordPress, OpenAI, etc.)
✅ Encrypted storage (AES-256-GCM)
✅ Per-user per-agent per-platform credentials
✅ Clean API for saving/retrieving
✅ n8n integration ready
✅ NO OAuth complexity!

**What You Need to Build:**
- Frontend credential forms (per platform)
- Credential status UI (show connected platforms)
- Update n8n workflows to use HTTP Request nodes

**Time to Complete:** 1-2 days of frontend work

---

**This is the simple, clean approach you wanted!** No OAuth, no .env.local hassles, just straightforward credential collection and passing to n8n. 🎯
