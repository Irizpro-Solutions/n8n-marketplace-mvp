# Testing Guide - Credential System Fixes

**Date:** January 30, 2026

## Fixes Applied

### ✅ Fix 1: Admin Panel Error
**Problem:** `showCustomPlatformModal is not defined`
**Cause:** Modal component was inside `MultiCurrencyPricingForm` instead of `AdminPanel`
**Fix:** Moved `<CustomPlatformModal>` to correct component scope

### ✅ Fix 2: Credentials Not Showing as Connected
**Problem:** Credentials save successfully but sidebar still shows "not connected"
**Cause:** Field name mismatch (`platform_slug` vs `platform`)
**Fix:** Updated sidebar to handle both field names

### ✅ Fix 3: Enhanced Debug Logging
**Added:** Detailed console logs to track credential save and load process

---

## Step-by-Step Testing

### **STEP 1: Restart Development Server**

```bash
# Stop current server (Ctrl+C if running)

# Start fresh
npm run dev
```

**Expected:** Server starts without errors

---

### **STEP 2: Test Admin Panel (Fix #1)**

1. Open browser: `http://localhost:3000/admin`
2. Click **"Create New Agent"** button
3. Scroll down to **"🔐 Required Credentials (Optional)"** section
4. Click **"➕ Custom Platform"** button

**✅ Expected Result:**
- Modal opens successfully
- No `ReferenceError` in console
- Form shows fields for creating custom platform

**❌ If Error Still Appears:**
- Press `Ctrl+Shift+R` (hard refresh)
- Clear browser cache
- Check console for different error

---

### **STEP 3: Test Credential Saving (Fix #2)**

#### A. Open Dashboard
1. Go to: `http://localhost:3000/dashboard`
2. Find agent that requires credentials (e.g., "SEO Blog Generator")
3. Click **"🔐 Manage Credentials"** button

**✅ Expected:**
- Sidebar slides in from right
- Shows credential platform cards
- WordPress shows **"⚠️ Not Connected"** in orange card

#### B. Fill Credentials
1. Click **"Connect WordPress"** button
2. Fill the form:
   - **WordPress Site URL:** `https://test.com`
   - **WordPress Username:** `admin`
   - **Application Password:** `test 1234 5678 9012`
3. Click **"Save & Continue to Agent"** button

**✅ Expected Console Logs (F12 → Console):**
```
✅ Credentials saved successfully: { platform: 'wordpress', response: {...} }
🎉 All platforms configured!
[Sidebar] Credential saved callback triggered
[Sidebar] Loaded credential status: {
  hasAllCredentials: true,
  credentialsArray: [ { platform: 'wordpress', is_active: true, ... } ],
  credentialsLength: 1,
  credentialsRaw: "[ { ... } ]"
}
[Sidebar] Credential: {
  platformSlug: 'wordpress',
  isActive: true,
  metadata: null,
  rawCred: { ... }
}
[Sidebar] Final platform state: {
  platformDefs: [ { slug: 'wordpress', name: 'WordPress', connected: true, ... } ],
  connectedCount: 1,
  missingCount: 0
}
```

#### C. Check Sidebar UI
After save completes (within 1 second):

**✅ Expected UI Changes:**
1. Sidebar header changes from "Configure WordPress" to credential list
2. **"✅ Connected Platforms (1)"** section appears (green)
3. WordPress card shows:
   - Green background (`bg-green-500/10`)
   - Green pulsing dot (`● WordPress`)
   - **"Update"** button
   - **"Disconnect"** button
4. **"⚠️ Required Credentials (0)"** section is empty
5. Bottom shows: **"🎉 All Credentials Connected!"** message

**❌ If Still Shows "Not Connected":**

Check these console values:

1. **`credentialsLength`**: Should be `1` (not `0`)
2. **`credentialsRaw`**: Should show array with WordPress entry
3. **`platformSlug`**: Should be `'wordpress'` (not undefined)
4. **`isActive`**: Should be `true`
5. **`connectedCount`**: Should be `1`

**Possible Issues:**
- If `credentialsLength: 0` → Credential didn't save to database
- If `platformSlug: undefined` → API returning wrong field name
- If `isActive: false` → Credential was disconnected
- If `connectedCount: 0` → Mapping logic failed

---

### **STEP 4: Test Update Credential**

1. In sidebar, click **"Update"** button on WordPress card
2. Form should open with empty fields (for security)
3. Enter new credentials:
   - Site URL: `https://updated-site.com`
   - Username: `newadmin`
   - Password: `new 1234 5678 9012`
4. Click **"Save & Continue to Agent"**

**✅ Expected:**
- Save success message in console
- Sidebar reloads
- Still shows as connected
- Can click "← Back to credential list" to return

---

### **STEP 5: Test Disconnect Credential**

1. In sidebar, click **"Disconnect"** button on WordPress
2. Confirmation dialog appears
3. Click **"OK"**

**✅ Expected:**
- Sidebar reloads
- WordPress moves to **"⚠️ Required Credentials (1)"** section
- Shows orange warning card
- Shows **"Connect WordPress"** button
- **"Not Connected"** badge appears

---

### **STEP 6: Test Multiple Platforms**

#### Create Agent with Multiple Credentials
1. Go to `/admin`
2. Create new agent or edit existing
3. In "Required Credentials" section, select:
   - ☑ WordPress
   - ☑ OpenAI
   - ☑ Ahrefs
4. Save agent

#### Test Sequential Connection
1. Go to `/dashboard`
2. Click "Manage Credentials" on the new agent
3. **Expected:** Sidebar shows all 3 platforms as "Not Connected"
4. Connect them one by one:
   - Connect WordPress → Saves → Shows connected
   - Connect OpenAI → Saves → Shows connected
   - Connect Ahrefs → Saves → Shows connected
5. **Final state:**
   - Connected: 3
   - Missing: 0
   - "All Credentials Connected!" message

---

## Console Log Reference

### **Successful Save Flow:**

```
1. User clicks "Save"
   ↓
2. ✅ Credentials saved successfully: {...}
   ↓
3. 🎉 All platforms configured!
   ↓
4. [500ms delay for DB update]
   ↓
5. [Sidebar] Loaded credential status: { credentialsLength: 1 }
   ↓
6. [Sidebar] Credential: { platformSlug: 'wordpress', isActive: true }
   ↓
7. [Sidebar] Final platform state: { connectedCount: 1 }
   ↓
8. UI Updates: Shows green "Connected" card
```

### **Failed Save Flow:**

```
1. User clicks "Save"
   ↓
2. ❌ Save failed: { error: "..." }
   ↓
3. Error message displayed in form
   ↓
4. Credentials remain disconnected
```

---

## Troubleshooting

### Issue: Admin panel still crashes

**Check:**
1. Is dev server restarted?
2. Hard refresh browser (`Ctrl+Shift+R`)
3. Console error different from before?

**Try:**
```bash
rm -rf .next
npm run dev
```

### Issue: Credentials save but don't show

**Debug Steps:**

1. **Open Console (F12)**
2. **Look for this log:** `[Sidebar] Loaded credential status`
3. **Expand the object**
4. **Check these values:**

```javascript
{
  hasAllCredentials: true,      // ✅ Good
  credentialsArray: [            // ✅ Should have items
    {
      platform: 'wordpress',     // ✅ Platform name
      is_active: true,           // ✅ Active
      ...
    }
  ],
  credentialsLength: 1,          // ✅ Should be > 0
  credentialsRaw: "[{...}]"      // ✅ JSON string
}
```

5. **If credentialsLength is 0:**
   - Credential didn't save to database
   - Check `POST /api/credentials/save` in Network tab
   - Should return 200 OK

6. **If credentialsLength > 0 but still shows disconnected:**
   - Check `platformSlug` in credential object
   - Should match required platform slug exactly
   - Case-sensitive: `'wordpress'` not `'WordPress'`

### Issue: Form closes but doesn't save

**Symptoms:**
- Click "Save"
- Form closes immediately
- Opens again as blank
- Console shows no save log

**Cause:** Form validation failed

**Check:**
- Are all required fields filled?
- Is Site URL a valid URL format?
- Is password field not empty?

**Fix:**
- Console should show validation error
- Fill all required fields (marked with `*`)

---

## Expected Final State

After all tests pass:

### Admin Panel
- ✅ No errors when opening
- ✅ Can create/edit agents
- ✅ "Custom Platform" button works
- ✅ Can select multiple credential platforms

### Dashboard Sidebar
- ✅ Opens smoothly from right
- ✅ Shows platform status correctly
- ✅ Green cards for connected platforms
- ✅ Orange cards for missing platforms
- ✅ Update/Disconnect buttons work
- ✅ "All Credentials Connected!" shows when complete

### Console
- ✅ Clear success messages
- ✅ Detailed status logs
- ✅ No undefined errors
- ✅ No reference errors

---

## Report Issues

If tests still fail after following this guide:

**Provide:**
1. Screenshot of console logs (expanded objects)
2. Screenshot of sidebar UI
3. Network tab screenshot showing API calls
4. Steps that led to the error

**Check:**
- Browser: Chrome/Edge (latest)
- Dev server running on port 3000
- No other errors in terminal
- Database connection working

---

**Ready to test!** Start with Step 1 and work through each step carefully.
