# Credential Collection Flow Implementation

## Summary

Fixed the credential collection flow so users are prompted to provide required credentials (API keys, WordPress credentials, etc.) **before** executing agents for the first time.

## Changes Made

### 1. Updated API Endpoint: `/api/credentials/status`
**File:** `src/app/api/credentials/status/route.ts`

- Switched from legacy `hasCredentials()` to platform-based `hasAllRequiredCredentials()`
- Returns detailed status:
  ```json
  {
    "has_all_credentials": true/false,
    "missing_platforms": ["wordpress", "openai"],
    "required_platforms": ["wordpress", "openai", "ahrefs"]
  }
  ```

### 2. Enhanced Credential Manager
**File:** `src/lib/credential-manager.ts`

- Updated `hasAllRequiredCredentials()` to return `required` platforms list
- Return type: `{ hasAll: boolean; missing: string[]; required: string[] }`

### 3. Created New Component: `PlatformCredentialsForm`
**File:** `src/components/credentials/PlatformCredentialsForm.tsx`

**Features:**
- Supports multiple platform credential collection
- Loads field schemas from `credential_platform_definitions` table
- Step-by-step wizard (Platform 1 of N)
- Progress indicator showing completion percentage
- Shows setup instructions per platform
- Validates required fields before saving
- Calls `/api/credentials/save` for each platform
- `onComplete` callback when all platforms are configured

**Props:**
```typescript
interface PlatformCredentialsFormProps {
  agentId: string;
  agentName: string;
  requiredPlatforms: string[]; // Platform slugs like ["wordpress", "openai"]
  onComplete?: () => void;
  onCancel?: () => void;
}
```

### 4. Created API Endpoint: `/api/credentials/platform-definition`
**File:** `src/app/api/credentials/platform-definition/route.ts`

- Returns field schema for a specific platform
- Used by `PlatformCredentialsForm` to load form fields
- Example: `GET /api/credentials/platform-definition?slug=wordpress`

### 5. Created API Endpoint: `/api/credentials/platforms`
**File:** `src/app/api/credentials/platforms/route.ts`

- Returns all available credential platforms
- Used by admin panel to show platform selector

### 6. Updated Dashboard
**File:** `src/app/dashboard/page.tsx`

**New State:**
- `showCredentialForm: boolean` - Controls credential form visibility
- `credentialStatus: CredentialStatus | null` - Stores credential check result
- `checkingCredentials: boolean` - Loading state during credential check

**New Functions:**
- `checkCredentialStatus(agentId)` - Calls `/api/credentials/status`
- `handleAgentClick(agent)` - Checks credentials before showing form
- `handleCredentialsSaved()` - Callback after credentials are saved

**Updated Flow:**
```
User clicks "Execute Agent" button
  → handleAgentClick() triggered
  → Check if agent.required_platforms exists
  → If yes: Call checkCredentialStatus(agentId)
  → If credentials missing: Show PlatformCredentialsForm
  → If credentials exist: Show execution form
  → If no platforms required: Show execution form directly
```

**Conditional Rendering:**
```tsx
{selectedAgent?.id === purchasedAgent.id ? (
  showCredentialForm ? (
    <PlatformCredentialsForm
      agentId={agent_id}
      agentName={name}
      requiredPlatforms={missing_platforms}
      onComplete={handleCredentialsSaved}
    />
  ) : checkingCredentials ? (
    <LoadingSpinner />
  ) : (
    <ExecutionForm />
  )
) : (
  <ExecuteButton onClick={handleAgentClick} />
)}
```

### 7. Updated Admin Panel
**File:** `src/app/admin/page.tsx`

**New State:**
- `availablePlatforms: any[]` - All available credential platforms
- `requiredPlatforms: string[]` - Selected platforms for current agent

**New Functions:**
- `loadAvailablePlatforms()` - Loads platforms from `/api/credentials/platforms`

**Updated Forms:**
- Replaced legacy credential fields text inputs
- Added platform selector with checkboxes
- Shows platform name and description
- Displays selected platforms summary

**Database Updates:**
- Create: Saves `required_platforms` array to agents table
- Edit: Loads and saves `required_platforms` array
- Reset: Clears `requiredPlatforms` state

## Complete User Flow

### First Time Execution (Credentials Not Configured)

1. User purchases agent with `required_platforms: ["wordpress", "openai"]`
2. User goes to dashboard, clicks "Execute Agent" button
3. Dashboard calls `/api/credentials/status?agentId=xxx`
4. API returns: `{ has_all_credentials: false, missing_platforms: ["wordpress", "openai"] }`
5. Dashboard shows `PlatformCredentialsForm` with:
   - Step 1: WordPress credential fields (site_url, username, application_password)
   - User fills and clicks "Save & Next Platform"
   - Step 2: OpenAI credential fields (api_key)
   - User fills and clicks "Save & Continue to Agent"
6. Credentials are encrypted and saved to `user_agent_credentials` table
7. `onComplete` callback triggers, credential form hides
8. Dashboard shows execution form with `input_schema` fields
9. User fills inputs and clicks "Execute"
10. Workflow runs with stored credentials

### Subsequent Executions (Credentials Already Configured)

1. User clicks "Execute Agent" button
2. Dashboard calls `/api/credentials/status?agentId=xxx`
3. API returns: `{ has_all_credentials: true, missing_platforms: [] }`
4. Dashboard **skips** credential form
5. Dashboard shows execution form directly
6. User fills inputs and clicks "Execute"
7. Workflow runs with stored credentials

### Agents Without Credential Requirements

1. User clicks "Execute Agent" button
2. Dashboard checks `agent.required_platforms` → empty or null
3. Dashboard **skips** credential check entirely
4. Dashboard shows execution form directly
5. User fills inputs and clicks "Execute"
6. Workflow runs without credentials

## Admin Configuration Flow

1. Admin goes to `/admin` panel
2. Admin clicks "Deploy New Agent" or "Edit" existing agent
3. Admin fills in agent details (name, description, webhook URL, etc.)
4. In "Required Credentials" section, admin sees checkboxes for:
   - WordPress (WordPress site publishing)
   - OpenAI (AI content generation)
   - Ahrefs (SEO analysis)
   - Semrush (Keyword research)
   - SERP API (Search results)
5. Admin checks required platforms (e.g., WordPress + OpenAI)
6. Admin clicks "Deploy Agent" or "Update Agent"
7. `required_platforms: ["wordpress", "openai"]` saved to database

## Database Schema

### agents table
```sql
required_platforms TEXT[]  -- Array of platform slugs like ["wordpress", "openai"]
```

### user_agent_credentials table
```sql
user_id UUID
agent_id UUID
platform_slug VARCHAR(50)  -- "wordpress", "openai", etc.
encrypted_credentials TEXT  -- Encrypted JSON: {"api_key": "sk-..."}
iv TEXT
auth_tag TEXT
credential_type credential_type  -- 'api_key', 'basic_auth', 'bearer_token'
is_active BOOLEAN
metadata JSONB  -- Optional: {"account_name": "My Blog"}
```

### credential_platform_definitions table
```sql
platform_slug VARCHAR(50)  -- "wordpress", "openai"
platform_name VARCHAR(100)  -- "WordPress", "OpenAI"
credential_type credential_type
field_schema JSONB  -- Array of field definitions
description TEXT
setup_instructions TEXT
```

## Testing Checklist

- [ ] Admin can select required platforms when creating agent
- [ ] Admin can update required platforms when editing agent
- [ ] User sees credential form on first execution if platforms required
- [ ] User can fill multi-platform credentials step-by-step
- [ ] Credentials are encrypted and saved correctly
- [ ] After saving credentials, execution form shows automatically
- [ ] On subsequent executions, credential form is skipped
- [ ] Agents without required_platforms show execution form directly
- [ ] Workflow execution receives credentials in correct format
- [ ] Error handling works if credential save fails

## Security Notes

- All credentials encrypted with AES-256-GCM before storage
- Each credential has unique IV (initialization vector)
- Authentication tags prevent tampering
- Row-level security (RLS) ensures users can only access their own credentials
- Credentials never logged or exposed in API responses
- Uses `supabaseAdmin` for credential operations to bypass RLS properly

## Next Steps (Optional Future Enhancements)

1. **OAuth 2.0 Support:** Implement OAuth flow using `credential-vault-v2.ts`
2. **Credential Edit/Update:** Allow users to update existing credentials
3. **Credential Disconnect:** UI to remove/revoke credentials
4. **Token Refresh:** Automatic OAuth token refresh before expiration
5. **Credential Validation:** Test credentials before saving (e.g., test OpenAI API key)
6. **Multiple Accounts:** Allow users to store multiple accounts per platform
