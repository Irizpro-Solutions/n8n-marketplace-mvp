/**
 * Razorpay Webhook Handler
 * Processes payment notifications from Razorpay asynchronously
 *
 * Security Features:
 * - Webhook signature verification (HMAC-SHA256)
 * - Idempotency (duplicate webhook detection)
 * - Atomic database operations
 * - Standard error handling
 * - Audit logging
 *
 * Note: This is a fallback. Primary payment processing happens in verify-payment route.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  asyncHandler,
  successResponse,
  PaymentError,
  ValidationError,
} from '@/lib/error-handler';
import { recordAuditLog, getOrCreateDefaultPackage } from '@/lib/database-utils';
import {
  PAYMENT,
  AGENT,
  ERROR_MESSAGES,
  HTTP_STATUS,
  DATABASE,
  AUDIT_LOG,
} from '@/lib/constants';

export const POST = asyncHandler(async (req: NextRequest) => {
  // 1. Verify webhook signature
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') || '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;

  if (!webhookSecret) {
    console.error('[WEBHOOK] Webhook secret not configured');
    throw new Error('Webhook configuration error');
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature !== signature) {
    console.error('[WEBHOOK][SECURITY] Invalid signature', {
      received_signature: signature.substring(0, 10),
      expected_signature: expectedSignature.substring(0, 10),
    });

    throw new PaymentError(ERROR_MESSAGES.PAYMENT.INVALID_SIGNATURE);
  }

  // 2. Parse webhook event
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error('[WEBHOOK] Failed to parse payload', err);
    throw new ValidationError('Invalid webhook payload');
  }

  console.log('[WEBHOOK] Received event', {
    event_type: event.event,
    payment_id: event.payload?.payment?.entity?.id,
  });

  // 3. Only process payment.captured events
  if (event.event !== 'payment.captured') {
    console.log('[WEBHOOK] Ignoring non-payment event', { event_type: event.event });
    return successResponse({ received: true }, HTTP_STATUS.OK);
  }

  const payment = event.payload.payment.entity;

  // 4. Extract metadata from notes
  const notes = payment.notes || {};
  const userId: string | undefined = notes.user_id;
  const packageId: string | undefined = notes.package_id;
  const credits = Number(notes.credits || 0);
  const amount = Number(notes.amount || 0);

  if (!userId || !packageId || !credits || !amount) {
    console.error('[WEBHOOK] Missing required metadata', { notes });
    throw new ValidationError('Missing required payment metadata');
  }

  // 5. Handle agent purchase package ID
  let finalPackageId = packageId;
  let agentId: string | null = null;

  if (packageId.startsWith(AGENT.PACKAGE_PREFIX)) {
    agentId = packageId.replace(AGENT.PACKAGE_PREFIX, '');
    finalPackageId = await getOrCreateDefaultPackage(amount, credits);
  }

  // 6. Process payment atomically (includes idempotency check)
  const { data: result, error: rpcError } = await supabaseAdmin.rpc(
    DATABASE.RPC.PROCESS_PAYMENT_ATOMIC,
    {
      p_user_id: userId,
      p_package_id: finalPackageId,
      p_razorpay_order_id: payment.order_id,
      p_razorpay_payment_id: payment.id,
      p_razorpay_signature: signature, // Store webhook signature
      p_amount_paid: Math.round(amount * PAYMENT.PAISE_MULTIPLIER),
      p_credits_purchased: credits,
      p_agent_id: agentId,
    }
  );

  // 7. Check result
  if (rpcError || !result || !result.success) {
    const errorMessage = rpcError?.message || result?.error || 'Unknown error';

    // Webhook might arrive after verify-payment already processed it
    if (errorMessage.includes('already processed')) {
      console.log('[WEBHOOK] Payment already processed', {
        payment_id: payment.id,
        user_id: userId,
      });

      return successResponse(
        {
          success: true,
          message: 'Payment already processed'
        },
        HTTP_STATUS.OK
      );
    }

    console.error('[WEBHOOK] Payment processing failed', {
      payment_id: payment.id,
      error: errorMessage,
    });

    throw new PaymentError(errorMessage);
  }

  // 8. Log successful webhook processing
  console.log('[WEBHOOK] Payment processed successfully', {
    payment_id: payment.id,
    user_id: userId,
    credits_added: credits,
    new_balance: result.new_balance,
  });

  // 9. Record audit log
  await recordAuditLog({
    userId,
    action: AUDIT_LOG.ACTION.PAYMENT,
    resource: AUDIT_LOG.RESOURCE.PAYMENT,
    resourceId: result.purchase_id,
    details: {
      source: 'webhook',
      event_type: event.event,
      payment_id: payment.id,
      order_id: payment.order_id,
      credits_purchased: credits,
      amount_paid: amount,
      currency: payment.currency || PAYMENT.DEFAULT_CURRENCY,
      agent_id: agentId,
      new_balance: result.new_balance,
    },
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
    userAgent: req.headers.get('user-agent') || undefined,
  });

  // 10. Return success
  return successResponse(
    {
      success: true,
      message: 'Webhook processed successfully',
    },
    HTTP_STATUS.OK
  );
});