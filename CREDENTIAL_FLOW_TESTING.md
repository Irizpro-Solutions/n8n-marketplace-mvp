# Credential Flow Testing Guide

## Quick Start

The credential collection flow is now fully implemented. Follow these steps to test it.

## Prerequisites

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Ensure database has platform definitions (run migration if needed):
   ```bash
   # Check if credential_platform_definitions table has data
   # Should have: wordpress, openai, ahrefs, semrush, serpapi
   ```

## Testing Steps

### Part 1: Admin Configuration

1. **Login as Admin:**
   - Go to: `http://localhost:3000/auth/login`
   - Login with: `team@irizpro.com`

2. **Navigate to Admin Panel:**
   - Go to: `http://localhost:3000/admin`

3. **Create or Edit an Agent:**
   - Click "Deploy New Agent" or "Edit" on existing agent
   - Scroll to **"🔐 Required Credentials"** section
   - You should see checkboxes for available platforms:
     - ☐ WordPress (WordPress site publishing)
     - ☐ OpenAI (AI content generation)
     - ☐ Ahrefs (SEO analysis)
     - ☐ Semrush (Keyword research)
     - ☐ SERP API (Search results)

4. **Select Required Platforms:**
   - Check "WordPress" and "OpenAI" (or any combination)
   - You should see: "Selected: WordPress, OpenAI" at the bottom
   - Click "Deploy Agent" or "Update Agent"

5. **Verify Save:**
   - Agent should save successfully
   - Reload admin page and edit the agent again
   - Selected platforms should still be checked

### Part 2: User Credential Collection (First Time)

1. **Login as Regular User:**
   - Logout admin
   - Login as a test user (or create new account)

2. **Purchase the Agent:**
   - If not already purchased, go to `/browse`
   - Purchase the agent you configured in Part 1
   - Complete payment (or use test mode)

3. **Go to Dashboard:**
   - Navigate to: `http://localhost:3000/dashboard`
   - You should see the purchased agent

4. **Click "Execute Agent":**
   - **Expected:** Credential setup form appears (NOT execution form)
   - **Should show:** "🔐 Configure WordPress" (Platform 1 of 2)
   - **Should display:** Progress bar showing "50% Complete"

5. **Fill WordPress Credentials:**
   - WordPress Site URL: `https://yoursite.com`
   - WordPress Username: `admin`
   - Application Password: `xxxx xxxx xxxx xxxx`
   - Click "Save & Next Platform"

6. **Fill OpenAI Credentials:**
   - **Expected:** Form changes to "🔐 Configure OpenAI" (Platform 2 of 2)
   - **Should show:** Progress bar showing "100% Complete"
   - OpenAI API Key: `sk-test123...`
   - Click "Save & Continue to Agent"

7. **Execution Form Appears:**
   - **Expected:** Credential form disappears
   - **Expected:** Agent execution form with input fields appears
   - Fill in the agent's input fields
   - Click "Execute"

8. **Workflow Runs:**
   - Workflow should execute successfully
   - n8n receives credentials in payload:
     ```json
     {
       "inputs": { /* user inputs */ },
       "user": { "id": "...", "email": "..." },
       "credentials": {
         "wordpress": {
           "site_url": "https://yoursite.com",
           "username": "admin",
           "application_password": "xxxx xxxx xxxx xxxx"
         },
         "openai": {
           "api_key": "sk-test123..."
         }
       }
     }
     ```

### Part 3: User Subsequent Executions (Credentials Exist)

1. **Click "Execute Agent" Again:**
   - **Expected:** Credential form is **SKIPPED**
   - **Expected:** Execution form appears directly
   - Credentials are automatically loaded from database

2. **Fill Inputs and Execute:**
   - Workflow runs with previously saved credentials
   - No need to re-enter credentials

### Part 4: Agent Without Credentials

1. **Admin Creates Agent Without Platforms:**
   - Go to admin panel
   - Create agent
   - Leave all platform checkboxes **unchecked**
   - `required_platforms` will be `null` or `[]`

2. **User Executes Agent:**
   - Purchase agent
   - Click "Execute Agent"
   - **Expected:** Execution form appears **immediately**
   - **Expected:** No credential form shown
   - Workflow runs without credentials

## Troubleshooting

### Credential Form Not Showing

**Issue:** Clicking "Execute Agent" shows execution form instead of credential form

**Checks:**
1. Verify agent has `required_platforms` set in database:
   ```sql
   SELECT name, required_platforms FROM agents WHERE id = 'xxx';
   ```
2. Check console for errors in credential status API call
3. Verify `/api/credentials/status` returns correct response
4. Check dashboard state: `showCredentialForm` should be `true`

### Platform Checkboxes Not Showing in Admin

**Issue:** No platforms visible in admin panel

**Checks:**
1. Verify `/api/credentials/platforms` returns data:
   ```bash
   curl http://localhost:3000/api/credentials/platforms
   ```
2. Check `credential_platform_definitions` table has data:
   ```sql
   SELECT platform_slug, platform_name FROM credential_platform_definitions;
   ```
3. Run migration if table is empty:
   ```bash
   # Apply migration: supabase/migrations/20260128_simple_credential_system_safe.sql
   ```

### Credentials Not Saving

**Issue:** Error when saving credentials

**Checks:**
1. Verify `CREDENTIAL_ENCRYPTION_KEY` is set in `.env.local` (64 hex characters)
2. Check browser console for API errors
3. Verify field names match platform definition schema
4. Check database RLS policies allow insert/update to `user_agent_credentials`

### Workflow Not Receiving Credentials

**Issue:** n8n workflow doesn't receive credentials in payload

**Checks:**
1. Verify `/api/run-workflow` calls `retrieveAllAgentCredentials()`:
   ```typescript
   const credentialMap = await retrieveAllAgentCredentials(user.id, agentId);
   ```
2. Check console logs in `/api/run-workflow` for credential retrieval
3. Verify credentials are passed to `callN8nWebhook()`:
   ```typescript
   await callN8nWebhook(webhookUrl, inputs, userCredentials, user.id, user.email);
   ```
4. Check n8n workflow receives `$json.credentials` object

## API Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/credentials/status?agentId=xxx` | GET | Check if user has all required credentials |
| `/api/credentials/platforms` | GET | Get all available credential platforms |
| `/api/credentials/platform-definition?slug=wordpress` | GET | Get field schema for specific platform |
| `/api/credentials/save` | POST | Save encrypted credentials for user-agent-platform |

## Component Reference

| Component | Location | Purpose |
|-----------|----------|---------|
| `PlatformCredentialsForm` | `src/components/credentials/` | Multi-platform credential collection wizard |
| `AgentCredentialsForm` | `src/components/credentials/` | Legacy single-form credential collection (deprecated) |

## Database Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `hasAllRequiredCredentials(userId, agentId)` | `credential-manager.ts` | Check if user has all required platforms |
| `storePlatformCredentials(...)` | `credential-manager.ts` | Encrypt and save credentials |
| `retrieveAllAgentCredentials(userId, agentId)` | `credential-manager.ts` | Decrypt and retrieve all credentials |
| `getPlatformDefinition(slug)` | `credential-manager.ts` | Get platform field schema |
| `getAllPlatformDefinitions()` | `credential-manager.ts` | Get all available platforms |
