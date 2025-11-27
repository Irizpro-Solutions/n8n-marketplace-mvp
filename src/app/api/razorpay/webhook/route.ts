import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/supabaseAdmin';

export const POST = async (req: NextRequest) => {
  // 1) Read raw body for signature verification
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') || '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;

  // 2) Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature !== signature) {
    console.error('Invalid Razorpay webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // 3) Parse event
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error('Failed to parse webhook body', err);
    return NextResponse.json({ error: 'Bad payload' }, { status: 400 });
  }

  // We only care about successful payment
  if (event.event !== 'payment.captured') {
    return NextResponse.json({ received: true }); // ignore others
  }

  const payment = event.payload.payment.entity;

  // 4) Metadata from notes (we set this in create-order route)
  const notes = payment.notes || {};
  const userId: string | undefined = notes.user_id;
  const packageId: string | undefined = notes.package_id;
  const credits = Number(notes.credits || 0);

  if (!userId || !packageId || !credits) {
    console.error('Missing metadata in webhook', { notes });
    return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
  }

  const amount = payment.amount / 100; // Razorpay stores in paise

  try {
    // 5) Insert into credit_purchases
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('credit_purchases')
      .insert({
        user_id: userId,
        package_id: packageId,
        amount,
        currency: payment.currency,
        razorpay_payment_id: payment.id,
        razorpay_order_id: payment.order_id,
        status: 'completed',
      })
      .select()
      .single();

    if (purchaseError) {
      console.error('Failed to insert credit_purchases', purchaseError);
      throw purchaseError;
    }

    // 6) Insert into credit_transactions
    const { error: txError } = await supabaseAdmin
      .from('credit_transactions')
      .insert({
        user_id: userId,
        change: credits,
        type: 'purchase',
        purchase_id: purchase.id,
      });

    if (txError) {
      console.error('Failed to insert credit_transactions', txError);
      throw txError;
    }

    // 7) Update users.credits (simple: read then update)
    const { data: userRow, error: userFetchError } = await supabaseAdmin
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single();

    if (userFetchError) {
      console.error('Failed to fetch user for credit update', userFetchError);
      throw userFetchError;
    }

    const currentCredits = userRow?.credits ?? 0;
    const newCredits = currentCredits + credits;

    const { error: userUpdateError } = await supabaseAdmin
      .from('users')
      .update({ credits: newCredits })
      .eq('id', userId);

    if (userUpdateError) {
      console.error('Failed to update user credits', userUpdateError);
      throw userUpdateError;
    }

    console.log(`Credits updated for user ${userId}: +${credits} -> ${newCredits}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Webhook processing error', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
};
