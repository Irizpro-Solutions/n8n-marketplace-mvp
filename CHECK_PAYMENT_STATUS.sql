-- Check if the payment was actually processed successfully
-- Run this in Supabase SQL Editor

-- 1. Check credit_purchases table for the payment
SELECT
    id,
    user_id,
    razorpay_payment_id,
    razorpay_order_id,
    credits_purchased,
    amount_paid,
    status,
    created_at
FROM credit_purchases
WHERE razorpay_payment_id = 'pay_SA4nByata2r4KO'
ORDER BY created_at DESC;

-- 2. Check user's current credit balance
SELECT
    id,
    email,
    credits,
    total_spent,
    updated_at
FROM profiles
WHERE email = 'irizprohr@gmail.com';

-- 3. Check credit_transactions for this purchase
SELECT
    id,
    user_id,
    type,
    amount,
    balance_after,
    purchase_id,
    created_at
FROM credit_transactions
WHERE user_id = (SELECT id FROM profiles WHERE email = 'irizprohr@gmail.com')
ORDER BY created_at DESC
LIMIT 5;

-- 4. Check user_agents access (if it was an agent purchase)
SELECT
    ua.id,
    ua.user_id,
    ua.agent_id,
    ua.purchased_at,
    a.name as agent_name
FROM user_agents ua
JOIN agents a ON a.id = ua.agent_id
WHERE ua.user_id = (SELECT id FROM profiles WHERE email = 'irizprohr@gmail.com')
ORDER BY ua.purchased_at DESC;
