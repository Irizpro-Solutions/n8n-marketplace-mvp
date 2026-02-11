/**
 * Create Razorpay Order Route
 * Creates a Razorpay payment order with server-validated pricing
 *
 * Security Features:
 * - Rate limiting (10 requests/minute)
 * - Input validation with Zod
 * - Server-side agent lookup and price calculation (never trusts client amount)
 * - Standard error handling
 * - Audit logging
 * - Profile creation if needed
 */

import { NextRequest } from 'next/server';
import Razorpay from 'razorpay';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  asyncHandler,
  successResponse,
  AuthenticationError,
  ValidationError,
} from '@/lib/error-handler';
import { createOrderSchema } from '@/lib/validation-schemas';
import { withRateLimit, paymentRateLimiter } from '@/lib/rate-limiter';
import { recordAuditLog } from '@/lib/database-utils';
import { getPrice, type PricingConfig } from '@/lib/currency';
import {
  PAYMENT,
  ERROR_MESSAGES,
  HTTP_STATUS,
  AUDIT_LOG,
  DATABASE,
  AGENT,
} from '@/lib/constants';

export const POST = withRateLimit(
  paymentRateLimiter,
  asyncHandler(async (req: NextRequest) => {
    // 1. Validate environment variables
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error('[PAYMENT] Razorpay credentials missing');
      throw new Error('Payment configuration error. Please contact support.');
    }

    // 2. Validate request body (no amount or packageId from client)
    const validatedData = await req.json().then((data) =>
      createOrderSchema.parse(data)
    );

    const { agentId, credits, currency = 'INR' } = validatedData;

    // 3. Authenticate user
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(ERROR_MESSAGES.AUTH.UNAUTHORIZED);
    }

    const userId = user.id;
    const userEmail = user.email ?? '';

    // 4. Look up agent from database (server-side price source of truth)
    const { data: agent, error: agentError } = await supabaseAdmin
      .from(DATABASE.TABLES.AGENTS)
      .select('id, name, credit_cost, pricing_config, is_active')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      throw new ValidationError('Agent not found');
    }

    if (!agent.is_active) {
      throw new ValidationError('Agent is not available for purchase');
    }

    // 5. Server-side price calculation (never trust client-provided amount)
    const pricingConfig: PricingConfig = agent.pricing_config || { basePrice: agent.credit_cost };
    const pricePerCredit = getPrice(pricingConfig, currency);
    const totalAmount = Math.round(pricePerCredit * credits * 100) / 100;
    const packageId = `${AGENT.PACKAGE_PREFIX}${agentId}`;

    console.log('[Payment] Server-computed pricing:', {
      agentId,
      currency,
      pricePerCredit,
      credits,
      totalAmount,
    });

    // 6. Ensure user profile exists
    const { data: existingProfile } = await supabase
      .from(DATABASE.TABLES.PROFILES)
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!existingProfile) {
      const now = new Date().toISOString();
      const { error: profileError } = await supabase
        .from(DATABASE.TABLES.PROFILES)
        .insert({
          id: userId,
          email: userEmail,
          full_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            userEmail.split('@')[0],
          credits: 0,
          total_spent: 0,
          total_executions: 0,
          membership_tier: 'free',
          is_active: true,
          role: 'user',
          created_at: now,
          updated_at: now,
        });

      if (profileError) {
        console.error('[PROFILE] Failed to create profile:', {
          error: profileError,
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          userId,
          userEmail,
        });
        throw new Error(`Failed to create user profile: ${profileError.message}`);
      }

      console.log('[PROFILE] Created new profile', { user_id: userId });
    }

    // 7. Create Razorpay order with server-computed amount
    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    const order = await razorpay.orders.create({
      amount: Math.round(totalAmount * PAYMENT.PAISE_MULTIPLIER),
      currency: currency,
      receipt: `cp_${Date.now().toString().slice(-8)}`,
      payment_capture: true,
      notes: {
        user_id: userId,
        user_email: userEmail,
        package_id: packageId,
        agent_id: agentId,
        agent_name: agent.name,
        credits: String(credits),
        amount: String(totalAmount),
        currency: currency,
        price_per_credit: String(pricePerCredit),
      },
    });

    console.log('[PAYMENT] Razorpay order created', {
      order_id: order.id,
      user_id: userId,
      amount: totalAmount,
      credits,
    });

    // 8. Record audit log
    await recordAuditLog({
      userId,
      action: AUDIT_LOG.ACTION.CREATE,
      resource: AUDIT_LOG.RESOURCE.PAYMENT,
      resourceId: order.id,
      details: {
        order_id: order.id,
        agent_id: agentId,
        agent_name: agent.name,
        package_id: packageId,
        amount: totalAmount,
        price_per_credit: pricePerCredit,
        credits,
        currency: currency,
      },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    // 9. Return order details (frontend uses server-provided amounts)
    return successResponse(
      {
        orderId: order.id,
        amount: order.amount,        // Amount in paise (for Razorpay modal)
        currency: order.currency,
        agentName: agent.name,
        pricePerCredit,
        totalAmount,                 // Human-readable amount
      },
      HTTP_STATUS.CREATED
    );
  })
);
