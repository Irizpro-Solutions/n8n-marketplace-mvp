# WordPress 401 Authentication Error Fix

## Error

```
401 - "Sorry, you are not allowed to create posts as this user."
```

## Root Cause

WordPress Application Passwords contain **spaces** (e.g., `MlbP 7Aex Tnww JbuD`), but when used with REST API Basic Authentication, the **spaces must be removed**.

## Solutions

### Solution 1: Re-enter Credentials (Recommended - Automatic Fix)

The platform now **automatically removes spaces** when saving WordPress credentials.

**Steps:**
1. Go to dashboard
2. Find the agent with WordPress credentials
3. Click to manage credentials (or re-execute to trigger credential form)
4. Re-enter the same WordPress application password (with spaces is fine)
5. Click save
6. **Spaces will be automatically removed before storage**
7. Try executing the workflow again

### Solution 2: Update n8n Workflow Expression (Manual Fix)

If you prefer to keep spaces in storage and remove them in n8n:

**Current n8n HTTP Request Authentication:**
```javascript
={
  "user": $('Webhook').item.json.body.credentials.wordpress.username,
  "password": $('Webhook').item.json.body.credentials.wordpress.application_password
}
```

**Updated (remove spaces):**
```javascript
={
  "user": $('Webhook').item.json.body.credentials.wordpress.username,
  "password": $('Webhook').item.json.body.credentials.wordpress.application_password.replace(/\s+/g, '')
}
```

The `.replace(/\s+/g, '')` removes all whitespace characters.

### Solution 3: Verify WordPress User Permissions

The error can also occur if the WordPress user doesn't have permission to create posts.

**Check WordPress User Role:**
1. Login to WordPress admin as administrator
2. Go to **Users → All Users**
3. Find user "Parth"
4. Check role: Should be **Administrator**, **Editor**, or **Author** (not Subscriber or Contributor)

**If user is Subscriber or Contributor:**
1. Click "Edit" on the user
2. Change "Role" to **Author** or **Editor**
3. Click "Update User"

**WordPress Roles and Post Permissions:**
- ✅ **Administrator** - Can create, edit, delete all posts
- ✅ **Editor** - Can create, edit, delete all posts
- ✅ **Author** - Can create, edit, delete own posts
- ❌ **Contributor** - Can create drafts only (cannot publish)
- ❌ **Subscriber** - Cannot create posts

### Solution 4: Verify Application Password is Valid

**Generate New Application Password:**
1. Login to WordPress as the user ("Parth")
2. Go to **Users → Profile**
3. Scroll to **Application Passwords** section
4. Enter a name: "n8n Marketplace"
5. Click **Add New Application Password**
6. Copy the password **immediately** (it's shown only once)
7. **Copy with spaces** (e.g., `MlbP 7Aex Tnww JbuD JDyY`)
8. Paste into the credential form in the marketplace
9. The platform will automatically remove spaces before saving

## n8n Workflow Configuration

Your current setup looks correct. Just ensure:

**URL Expression:**
```javascript
{{ $('Webhook').item.json.body.credentials.wordpress.site_url }}/wp-json/wp/v2/posts
```

**Authentication:**
- Type: **Generic Credential Type**
- Generic Auth Type: **Expression** (not Fixed)
- Expression:
```javascript
={
  "user": $('Webhook').item.json.body.credentials.wordpress.username,
  "password": $('Webhook').item.json.body.credentials.wordpress.application_password.replace(/\s+/g, '')
}
```

**Request Body (example for creating post):**
```javascript
{
  "title": "{{ $('Webhook').item.json.body.inputs.title }}",
  "content": "{{ $('Webhook').item.json.body.inputs.content }}",
  "status": "publish"
}
```

## Testing

### Test 1: Verify Credentials Work Directly

Test the credentials using curl (replace with your actual values):

```bash
# Remove spaces from application password first
curl -X POST "https://irizpro.in/wp-json/wp/v2/posts" \
  -H "Content-Type: application/json" \
  -u "Parth:MlbP7AexTnwwJbuDJDyY" \
  -d '{
    "title": "Test Post",
    "content": "Test content",
    "status": "publish"
  }'
```

**Expected Success Response:**
```json
{
  "id": 123,
  "title": {
    "rendered": "Test Post"
  },
  "status": "publish"
  ...
}
```

**If you get 401 error:**
- Application password is incorrect
- User doesn't have post creation permissions
- Application passwords are disabled in WordPress

### Test 2: Check Application Passwords Enabled

In WordPress, go to **Settings → General** and ensure:
- ✅ Application Passwords are enabled (should be enabled by default in WordPress 5.6+)

If disabled, enable them in `wp-config.php`:
```php
// Remove this line if it exists:
define( 'WP_APPLICATION_PASSWORDS', false );
```

### Test 3: Check WordPress REST API

Verify REST API is accessible:
```bash
curl "https://irizpro.in/wp-json/wp/v2/posts"
```

**Expected:** Should return list of posts (even without authentication)

**If 404 or error:**
- REST API is disabled
- Permalinks not set to "Post name"
- `.htaccess` issue

## Common Issues

### Issue: "rest_cannot_create" Error

**Cause:** User doesn't have `create_posts` capability

**Fix:** Change WordPress user role to Author, Editor, or Administrator

### Issue: "rest_forbidden" Error

**Cause:** REST API is disabled or restricted

**Fix:** Remove any plugins that block REST API for authenticated users

### Issue: Application Password Has Spaces

**Cause:** WordPress generates passwords with spaces for readability

**Fix:** Our platform now automatically removes spaces. Just re-enter credentials.

### Issue: 404 on /wp-json/wp/v2/posts

**Cause:** Permalinks not configured correctly

**Fix:**
1. Go to WordPress admin → **Settings → Permalinks**
2. Select **Post name** (or any option except "Plain")
3. Click **Save Changes**

## Summary

**Immediate Fix:**
1. ✅ Platform now auto-removes spaces (code updated)
2. ⏭️ Re-enter WordPress credentials in dashboard
3. ⏭️ Execute workflow again

**Alternative Fix:**
- Update n8n expression to use `.replace(/\s+/g, '')`

**Verify:**
- WordPress user has Author/Editor/Administrator role
- Application password is valid and active
- REST API is accessible

After applying the fix, your WordPress API calls should work correctly! 🎉
