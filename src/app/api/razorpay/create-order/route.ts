// src/app/api/razorpay/create-order/route.ts
// CLEAN VERSION - ZERO DATABASE OPERATIONS
import Razorpay from 'razorpay';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
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

    console.log('🎯 Creating Razorpay order ONLY - NO database operations');

    // ONLY CREATE RAZORPAY ORDER - NOTHING ELSE
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `cp_${Date.now().toString().slice(-8)}`,
      notes: {
        user_id: userId,
        user_email: userEmail,
        package_id: packageId,
        credits: String(credits),
        amount: String(amount)
      },
    });

    console.log('✅ Razorpay order created:', order.id);
    console.log('❌ NO DATABASE OPERATIONS PERFORMED');

    return NextResponse.json({ orderId: order.id });
    
  } catch (err) {
    console.error('create-order route error:', err);
    return NextResponse.json(
      { error: 'Failed to create Razorpay order' },
      { status: 500 }
    );
  }
}