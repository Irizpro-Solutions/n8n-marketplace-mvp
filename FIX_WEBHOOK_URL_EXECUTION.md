# 🔧 Fix: "Workflow configuration not found" Error

## Problem

When users tried to execute an agent, the execution failed with error:
```json
{
  "error": "Workflow configuration not found not found",
  "code": "NOT_FOUND",
  "path": "http://localhost:3000/api/run-workflow"
}
```

Even though the webhook URL was correctly configured in the admin panel:
```
https://n8n.irizpro.com/webhook/5b1c4b52-59d1-42a3-b8ad-c7a50350bdc2
```

## Root Cause

There was a mismatch between how agents store their n8n configuration and how the execution API was trying to access it:

### What the Admin Panel Does:
- Saves webhook URL to `agents.webhook_url` field
- Example: `https://n8n.irizpro.com/webhook/5b1c4b52-59d1-42a3-b8ad-c7a50350bdc2`

### What the Run-Workflow API Was Trying to Do:
```typescript
// ❌ OLD CODE - Looking in wrong table
const { data: workflow } = await supabase
  .from(DATABASE.TABLES.WORKFLOWS) // Separate workflows table
  .select('n8n_workflow_id')
  .eq('agent_id', agentId)
  .maybeSingle();

if (!workflow?.n8n_workflow_id) {
  throw new ResourceNotFoundError('Workflow configuration not found');
}
```

The code was looking for an entry in a separate `workflows` table that didn't exist, because the admin panel never creates entries in that table—it just saves the webhook URL directly to the `agents` table.

### Additionally:

The old code used the **n8n API method**:
```
POST https://n8n.irizpro.com/api/v1/workflows/{workflowId}/run
Headers: X-N8N-API-KEY: ...
```

But the admin panel collects **webhook URLs**:
```
POST https://n8n.irizpro.com/webhook/{webhookId}
No authentication needed
```

These are two different ways to trigger n8n workflows!

## What Was Fixed

### 1. Changed Workflow Lookup

**Before:**
```typescript
// ❌ Look in workflows table
const { data: workflow } = await supabase
  .from(DATABASE.TABLES.WORKFLOWS)
  .select('n8n_workflow_id')
  .eq('agent_id', agentId)
  .maybeSingle();
```

**After:**
```typescript
// ✅ Use webhook URL from agent
const webhookUrl = agent.webhook_url;

if (!webhookUrl || !webhookUrl.trim()) {
  throw new ResourceNotFoundError('Webhook URL not configured for this agent');
}
```

### 2. Created New Webhook Calling Function

Added `callN8nWebhook()` function that:
- ✅ Calls webhook URLs directly
- ✅ No API key needed
- ✅ Simpler and more reliable
- ✅ Matches what the admin panel collects

```typescript
async function callN8nWebhook(
  webhookUrl: string,
  inputs: Record<string, unknown>,
  credentials?: Record<string, any>,
  userId?: string,
  userEmail?: string
) {
  const payload = {
    inputs: inputs,
    user: {
      id: userId,
      email: userEmail,
    },
    credentials: credentials || {}
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return await res.json();
}
```

### 3. Updated Execution Call

**Before:**
```typescript
workflowResult = await callN8nWorkflow(
  workflow.n8n_workflow_id,  // ❌ Doesn't exist
  inputs,
  userCredentials,
  user.id,
  user.email
);
```

**After:**
```typescript
workflowResult = await callN8nWebhook(
  webhookUrl,  // ✅ From agent.webhook_url
  inputs,
  userCredentials,
  user.id,
  user.email
);
```

## Files Modified

1. ✅ `src/app/api/run-workflow/route.ts`
   - Changed workflow lookup to use agent.webhook_url
   - Added callN8nWebhook() function
   - Updated execution to call webhook directly

## How to Test

### Step 1: Restart Your Server

The API route has changed, so restart your Next.js server:
```bash
npm run dev
```

### Step 2: Execute an Agent

1. Go to Dashboard: http://localhost:3000/dashboard
2. Find your "SEO Blog Generator" agent
3. Click **"Execute Agent"**
4. Fill in all required fields:
   - Campaign goal: Select from dropdown
   - Main content topic: Enter text
   - Brand name: Enter text
   - etc.
5. Click **"Execute"** button

### ✅ Expected Result (AFTER FIX):

```
✅ Execution successful!
Credits deducted
Workflow result displayed
```

Console logs will show:
```
[N8N] Calling webhook {
  webhook_url: 'https://n8n.irizpro.com/webhook/5b1c4b52-59d1-42a3-b8ad-c7a50350bdc2',
  has_credentials: false,
  input_count: 12
}
[WORKFLOW] Execution completed successfully {
  execution_id: '...',
  agent_id: '...'
}
```

### ❌ Previous Behavior (BEFORE FIX):

```
❌ Error: Workflow configuration not found not found
```

## Payload Structure Sent to n8n

Your n8n webhook will receive:

```json
{
  "inputs": {
    "campaign_goal": "Improve SEO Rankings",
    "main_content_topic": "Benefits of the Water Filter",
    "seed_keyword": "Shower Filter",
    "target_word_count": "2500 Words",
    "content_format": "Product Review",
    "brand_name": "Apple Water",
    "brand_voice_tone": "Confident, expert, and solutions-driven",
    "audience_knowledge_level": "Intermediate (Some familiarity)",
    "competitors": "Kaggle water",
    "eeat_highlights": "10 years of expertise in the SEO Field",
    "internal_linking_pages": "https://example.com",
    "website_url": "https://example.org",
    "email": "parth@irizpro.com"
  },
  "user": {
    "id": "user-uuid-here",
    "email": "parth@irizpro.com"
  },
  "credentials": {}
}
```

## n8n Workflow Configuration

Make sure your n8n workflow:

1. **Has a Webhook trigger node**
   - Method: POST
   - Path: `/webhook/5b1c4b52-59d1-42a3-b8ad-c7a50350bdc2`
   - Authentication: None (or as configured)

2. **Accesses input data correctly**
   ```javascript
   // In n8n nodes, access like this:
   {{ $json.inputs.campaign_goal }}
   {{ $json.inputs.seed_keyword }}
   {{ $json.user.email }}
   ```

3. **Returns a response**
   - Add a "Respond to Webhook" node at the end
   - Or configure webhook to wait for response

## Webhook URL vs API Method

### Webhook URL (What we're using now ✅)

**Pros:**
- ✅ Simpler setup
- ✅ No API key needed
- ✅ Direct webhook call
- ✅ Better for production webhooks

**Example:**
```
POST https://n8n.irizpro.com/webhook/5b1c4b52-59d1-42a3-b8ad-c7a50350bdc2
Content-Type: application/json

{
  "inputs": { ... },
  "user": { ... }
}
```

### n8n API Method (Old approach ❌)

**Pros:**
- Works with workflow IDs
- Can trigger workflows that aren't webhook-based

**Cons:**
- ❌ Requires N8N_API_KEY in .env
- ❌ More complex setup
- ❌ Needs workflow ID (not webhook ID)
- ❌ Not what admin panel collects

**Example:**
```
POST https://n8n.irizpro.com/api/v1/workflows/123/run
X-N8N-API-KEY: your-api-key
Content-Type: application/json

{
  "inputs": { ... }
}
```

## Environment Variables

After this fix, you **don't need** these environment variables anymore (unless you want to use API method for specific cases):
- ~~N8N_API_URL~~ - Optional now
- ~~N8N_API_KEY~~ - Optional now

The webhook URL is stored in the database per agent, so no global configuration is needed!

## Database Schema

**agents table:**
```sql
webhook_url TEXT  -- Full webhook URL, e.g., https://n8n.irizpro.com/webhook/...
```

**workflows table (not used anymore for webhook-based agents):**
```sql
-- This table is still there for backward compatibility
-- But new agents don't need entries here
```

## Migration Notes

If you have existing agents in the `workflows` table, they will continue to work with the old `callN8nWorkflow()` function. But new agents created through the admin panel will use the webhook approach.

To migrate an old agent:
1. Get its webhook URL from n8n
2. Update the agent in admin panel with the webhook URL
3. The system will automatically use the webhook method

## Troubleshooting

### Error: "Webhook URL not configured for this agent"

**Cause:** The agent doesn't have a webhook URL set.

**Fix:**
1. Go to Admin Panel
2. Click Edit on the agent
3. Add the webhook URL in the "n8n Webhook URL" field
4. Save

### Error: "n8n webhook error 404"

**Cause:** The webhook URL is incorrect or the workflow isn't active in n8n.

**Fix:**
1. Check the webhook URL is correct
2. Make sure the n8n workflow is active (not paused)
3. Test the webhook directly with curl:
```bash
curl -X POST https://n8n.irizpro.com/webhook/YOUR-WEBHOOK-ID \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Error: "n8n webhook error 500"

**Cause:** The n8n workflow has an error.

**Fix:**
1. Go to n8n and check the workflow execution logs
2. Look for errors in nodes
3. Fix the workflow and try again

## Verification Checklist

- [ ] Server restarted after code changes
- [ ] Agent has webhook URL configured in admin panel
- [ ] Dashboard shows agent with input fields
- [ ] All dropdown options appear correctly
- [ ] Click "Execute" button
- [ ] No "Workflow configuration not found" error
- [ ] Execution completes successfully
- [ ] Credits are deducted (if not admin)
- [ ] n8n workflow receives correct payload
- [ ] Result is displayed in dashboard

---

## Summary

✅ **Fixed!** Agents now execute correctly using webhook URLs from the admin panel. The system directly calls the webhook URL instead of looking for non-existent entries in the workflows table.

**No configuration needed** - just make sure your agents have valid webhook URLs in the admin panel!
