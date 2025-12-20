// Fixed src/app/api/razorpay/create-order/route.ts
// Only creates Razorpay orders - NO database logging until payment success
import Razorpay from 'razorpay';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: Request) {
  // Validate environment variables first
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

  console.log('🔑 Environment check:', {
    razorpayKeyId: razorpayKeyId ? `${razorpayKeyId.substring(0, 8)}...` : 'MISSING',
    razorpayKeySecret: razorpayKeySecret ? 'EXISTS' : 'MISSING',
    nodeEnv: process.env.NODE_ENV
  });

  if (!razorpayKeyId || !razorpayKeySecret) {
    console.error('❌ Razorpay environment variables are missing');
    return NextResponse.json(
      { 
        error: 'Payment configuration error. Please contact support.',
        debug: {
          keyId: razorpayKeyId ? 'exists' : 'missing',
          keySecret: razorpayKeySecret ? 'exists' : 'missing'
        }
      },
      { status: 500 }
    );
  }

  const razorpay = new Razorpay({
    key_id: razorpayKeyId,
    key_secret: razorpayKeySecret,
  });

  try {
    const { packageId, amount, credits } = await req.json();

    if (!packageId || !amount || !credits) {
      return NextResponse.json(
        { error: 'Missing packageId, amount or credits' },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = session.user.id;
    const userEmail = session.user.email ?? '';

    // Ensure user profile exists (for foreign key constraints later)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existingProfile) {
      // Create user profile if it doesn't exist
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: userEmail,
          full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || userEmail.split('@')[0],
          credits: 0,
          total_spent: 0,
          total_executions: 0,
          membership_tier: 'free',
          is_active: true
        });

      if (profileError) {
        console.error('Failed to create user profile:', profileError);
        return NextResponse.json(
          { error: 'Failed to create user profile' },
          { status: 500 }
        );
      }
    }

    // Create Razorpay order ONLY - no database logging yet
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `cp_${Date.now().toString().slice(-8)}`,
      notes: {
        user_id: userId,
        user_email: userEmail,
        package_id: packageId,
        credits: String(credits),
        amount: String(amount) // Store original amount in notes for later use
      },
    });

    console.log('✅ Razorpay order created (no DB logging until payment success):', order.id);

    // Return only order ID - database insert happens in verify-payment API
    return NextResponse.json({ orderId: order.id });
    
  } catch (err) {
    console.error('create-order route error:', err);
    return NextResponse.json(
      { error: 'Failed to create Razorpay order' },
      { status: 500 }
    );
  }
}