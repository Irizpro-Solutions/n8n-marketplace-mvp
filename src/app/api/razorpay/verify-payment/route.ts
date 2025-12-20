// src/app/api/razorpay/verify-payment/route.ts
// Handles payment verification and database logging ONLY after successful payment
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Missing required payment parameters' },
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

    // Verify Razorpay signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('❌ Razorpay signature verification failed');
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    console.log('✅ Payment verification successful');

    // Get order details from Razorpay
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const order = await razorpay.orders.fetch(razorpay_order_id);
    const notes = order.notes;
    
    const userId = notes.user_id;
    const packageId = notes.package_id;
    const credits = parseInt(notes.credits);
    const amount = parseFloat(notes.amount);

    console.log('📝 Processing payment for:', { userId, packageId, credits, amount });

    // Handle package_id for agent purchases
    let finalPackageId = packageId;
    
    if (packageId.startsWith('agent_')) {
      // Look for existing default package
      const { data: defaultPackage } = await supabase
        .from('credit_packages')
        .select('id')
        .eq('name', 'Agent Purchase Credits')
        .single();
      
      if (defaultPackage) {
        finalPackageId = defaultPackage.id;
      } else {
        // Create default package
        const { data: newPackage, error: packageError } = await supabase
          .from('credit_packages')
          .insert({
            name: 'Agent Purchase Credits',
            description: 'Credits for individual agent purchases',
            credits: 1,
            price_inr: Math.round(amount),
            is_active: true
          })
          .select('id')
          .single();
        
        if (!packageError && newPackage) {
          finalPackageId = newPackage.id;
        } else {
          console.error('Failed to create default package:', packageError);
          finalPackageId = null; // Will skip DB insert below
        }
      }
    }

    // NOW insert into database (only after successful payment)
    let purchaseId = null;
    if (finalPackageId) {
      const { data: purchaseData, error: dbError } = await supabase
        .from('credit_purchases')
        .insert({
          user_id: userId,
          package_id: finalPackageId,
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          amount_paid: Math.round(amount * 100), // in paise
          credits_purchased: credits,
          total_credits: credits,
          bonus_credits: 0,
          status: 'paid', // Mark as paid since payment is verified
          currency: 'INR',
          original_amount: amount,
          exchange_rate: 1.0
        })
        .select('id')
        .single();

      if (dbError) {
        console.error('Failed to insert credit_purchases:', dbError);
        return NextResponse.json(
          { error: 'Failed to record purchase' },
          { status: 500 }
        );
      }
      
      purchaseId = purchaseData?.id;
    }

    // Add credits to user profile - Fix SQL syntax
    // First get current credits
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('credits, total_spent')
      .eq('id', userId)
      .single();

    const currentCredits = currentProfile?.credits || 0;
    const currentTotalSpent = currentProfile?.total_spent || 0;

    const { error: creditsError } = await supabase
      .from('profiles')
      .update({
        credits: currentCredits + credits,
        total_spent: currentTotalSpent + Math.round(amount * 100)
      })
      .eq('id', userId);

    if (creditsError) {
      console.error('Failed to update user credits:', creditsError);
    }

    // Create credit transaction record
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      purchase_id: purchaseId, // Link to the credit purchase
      type: 'purchase',
      amount: credits,
      balance_after: currentCredits + credits, // Add balance tracking
      description: `Purchased ${credits} credits for agent ${packageId}`,
      currency: 'INR',
      original_amount: amount
    });

    console.log('✅ Payment processed and credits added successfully');

    // CRITICAL: Create user_agents relationship for dashboard access
    if (packageId.startsWith('agent_')) {
      const agentId = packageId.replace('agent_', '');
      
      // Check if user already has this agent (avoid duplicates)
      const { data: existingUserAgent } = await supabase
        .from('user_agents')
        .select('id')
        .eq('user_id', userId)
        .eq('agent_id', agentId)
        .single();

      if (!existingUserAgent) {
        const { error: userAgentError } = await supabase
          .from('user_agents')
          .insert({
            user_id: userId,
            agent_id: agentId,
            remaining_credits: credits // Set initial credits for this agent
          });

        if (userAgentError) {
          console.error('Failed to create user_agents relationship:', userAgentError);
        } else {
          console.log('✅ User-agent relationship created for dashboard access');
        }
      } else {
        // Agent already purchased, just add more credits
        const { data: currentUserAgent } = await supabase
          .from('user_agents')
          .select('remaining_credits')
          .eq('id', existingUserAgent.id)
          .single();

        const currentRemainingCredits = currentUserAgent?.remaining_credits || 0;

        const { error: updateError } = await supabase
          .from('user_agents')
          .update({
            remaining_credits: currentRemainingCredits + credits
          })
          .eq('id', existingUserAgent.id);

        if (updateError) {
          console.error('Failed to update agent credits:', updateError);
        } else {
          console.log('✅ Additional credits added to existing agent');
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Payment verified, credits added, and agent access granted',
      credits_added: credits,
      agent_access: packageId.startsWith('agent_') ? 'granted' : 'n/a'
    });
    
  } catch (err) {
    console.error('verify-payment route error:', err);
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}