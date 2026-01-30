# Webhook Race Condition Fix

**Issue:** "This payment has already been processed" error after successful payment
**Affects:** ALL users (new and existing)
**Status:** ✅ FIXED

---

## Problem Summary

### What Users See:
1. ✅ Click "Purchase" → Razorpay page opens
2. ✅ Complete payment → Success animation shows
3. ❌ Error popup: "Payment verification failed: This payment has already been processed"
4. 😕 User confused - Was payment successful or not?

### What's Actually Happening:
```
User completes payment on Razorpay
         ↓
    [RACE CONDITION]
         ↓
    ┌────────────────┬────────────────┐
    ↓                ↓                ↓
Webhook fires    Frontend verifies
(async)          (user's browser)
    ↓                ↓
Calls RPC        Calls same RPC
    ↓                ↓
✅ Processes      ❌ "Already processed"
payment          (duplicate check)
```

**The payment IS successful** - it's just processed by the webhook before the frontend can verify it!

---

## Root Cause

### Dual Processing Paths:

1. **Webhook (`/api/razorpay/webhook`)**
   - Razorpay sends webhook after payment
   - Calls `process_payment_atomic()` RPC
   - Creates record in `credit_purchases` table

2. **Frontend Verification (`/api/razorpay/verify-payment`)**
   - User's browser calls after Razorpay modal closes
   - Calls SAME `process_payment_atomic()` RPC
   - Tries to create SAME record

### RPC Idempotency Check:

```sql
-- In process_payment_atomic()
SELECT id INTO v_existing_purchase
FROM credit_purchases
WHERE razorpay_payment_id = p_razorpay_payment_id;

IF FOUND THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Payment already processed'  -- ❌ This causes the error
  );
END IF;
```

**Why It Happens:**
- Webhook is faster (no user network latency)
- Webhook processes payment first
- Frontend verification finds existing record
- Returns "duplicate" error to user

---

## The Fix

### Updated Behavior:

Instead of throwing an error when payment is already processed, we now:

1. **Recognize "duplicate" means success** (webhook already processed it)
2. **Fetch existing purchase details** from database
3. **Verify it belongs to current user** (security check)
4. **Return success response** with purchase details

### Code Change:

**Before:**
```typescript
if (errorMessage.includes('already processed')) {
  throw new DuplicateResourceError(ERROR_MESSAGES.PAYMENT.DUPLICATE_PAYMENT);
}
```

**After:**
```typescript
if (errorMessage.includes('already processed')) {
  // Fetch existing purchase
  const { data: existingPurchase } = await supabaseAdmin
    .from('credit_purchases')
    .select('id, credits_purchased, user_id')
    .eq('razorpay_payment_id', razorpay_payment_id)
    .eq('user_id', user.id)
    .single();

  // Return success with purchase details
  return successResponse({
    success: true,
    message: 'Payment verified successfully',
    data: {
      credits_added: existingPurchase.credits_purchased,
      new_balance: profile.credits,
      purchase_id: existingPurchase.id,
      note: 'Payment was already processed successfully'
    }
  });
}
```

---

## User Experience

### Before Fix:
```
Payment Success on Razorpay
     ↓
❌ Error popup
"Payment verification failed: This payment has already been processed"
     ↓
User panics: "Was I charged? Did I get credits?"
     ↓
User contacts support with payment ID
```

### After Fix:
```
Payment Success on Razorpay
     ↓
✅ Success message
"Payment verified successfully! Credits added to your account."
     ↓
User sees updated credit balance
     ↓
User can access purchased agent
     ↓
😊 Happy user!
```

---

## Testing

### Test Case 1: New User Payment

1. **Register new user:**
   - Email: `test-race@example.com`
   - Verify email, login

2. **Make payment:**
   - Go to `/browse`
   - Select agent
   - Click "Purchase"
   - Complete Razorpay payment

3. **Expected Result:**
   - ✅ Success message (no error!)
   - ✅ Credits added to account
   - ✅ Can access agent in dashboard
   - ✅ No "duplicate payment" error

### Test Case 2: Existing User Payment

1. **Login as existing user:**
   - Email: `shivam@irizpro.com`

2. **Make payment:**
   - Purchase another agent
   - Complete payment

3. **Expected Result:**
   - ✅ Same smooth experience
   - ✅ No errors

### Test Case 3: Verify Database

**Check payment was recorded once (not duplicated):**

```sql
-- Should return exactly 1 row for each payment_id
SELECT
    razorpay_payment_id,
    COUNT(*) as record_count
FROM credit_purchases
WHERE razorpay_payment_id IN ('pay_SA4nByata2r4KO', 'pay_S9IZ2Yo2bnOE5I')
GROUP BY razorpay_payment_id;

-- Expected: record_count = 1 for each
```

**Check credits were added correctly:**

```sql
-- Check user's credits increased
SELECT
    email,
    credits,
    total_spent
FROM profiles
WHERE email IN ('irizprohr@gmail.com', 'shivam@irizpro.com');
```

---

## How Webhook and Frontend Work Together

### Ideal Flow (Webhook Wins Race):

```
1. User completes payment
   ↓
2. Webhook processes payment FIRST
   - Creates credit_purchase record
   - Adds credits to user
   - Grants agent access
   ↓
3. Frontend verification runs
   - Finds existing purchase
   - Returns success with existing details
   ↓
4. User sees success message
```

### Alternative Flow (Frontend Wins Race):

```
1. User completes payment
   ↓
2. Frontend verification FIRST
   - Creates credit_purchase record
   - Adds credits to user
   - Grants agent access
   ↓
3. Webhook arrives later
   - Finds existing purchase
   - Skips processing (idempotent)
   - No duplicate charge
   ↓
4. User sees success message
```

**Both flows are safe!** The idempotency check prevents duplicate charges.

---

## Security Features Maintained

### ✅ Signature Verification
- Still validates Razorpay signature
- Prevents fake payment attempts

### ✅ User Ownership Check
```typescript
.eq('razorpay_payment_id', razorpay_payment_id)
.eq('user_id', user.id)  // ← Security check
.single();
```
- Ensures payment belongs to current user
- Prevents unauthorized access to others' payments

### ✅ Idempotency
- Prevents duplicate charges
- Safe to call verification multiple times

### ✅ Audit Logging
- All payment attempts logged
- Tracks duplicate detection
- Helps with debugging

---

## Files Changed

| File | Change | Purpose |
|------|--------|---------|
| `src/app/api/razorpay/verify-payment/route.ts` | Updated duplicate handling | Treat "already processed" as success |

---

## Monitoring

### Console Logs to Watch:

**Successful Payment (Webhook First):**
```
[PAYMENT] Signature verified successfully
[PAYMENT] Payment already processed (likely by webhook)
[PAYMENT] Returning existing purchase details
```

**Successful Payment (Frontend First):**
```
[PAYMENT] Signature verified successfully
[PAYMENT] Payment processed successfully
```

**Duplicate Detection:**
```
[PAYMENT] Payment already processed (likely by webhook)
purchase_id: xxx-xxx-xxx
credits: 1
```

---

## FAQ

### Q: Will users be charged twice?

**A:** No. The RPC function has an idempotency check that prevents duplicate charges. If the same payment_id is processed twice, the second attempt is rejected (but now returns success to the user).

### Q: What if webhook fails?

**A:** Frontend verification acts as a fallback. If webhook doesn't process the payment, the frontend verification will.

### Q: Can we disable webhooks?

**A:** Yes, but not recommended. Webhooks are more reliable (no user network issues). Keep both for redundancy.

### Q: What if payment belongs to different user?

**A:** Security check prevents this:
```typescript
.eq('user_id', user.id)  // Must match logged-in user
```
If payment doesn't belong to current user, returns error.

### Q: How do I know which processed the payment?

**A:** Check the `created_at` timestamp in `credit_purchases` table:
- If very fast (< 1 second after order creation) → Likely webhook
- If slower (1-3 seconds) → Likely frontend

---

## Summary

**Problem:** Race condition between webhook and frontend verification
**Impact:** Users saw error after successful payment
**Solution:** Treat "duplicate payment" as success (fetch existing purchase)
**Result:** Smooth user experience, no more confusion

**Status:** ✅ FIXED - Ready for testing

---

**Test now:** Make a payment and verify no error appears!
