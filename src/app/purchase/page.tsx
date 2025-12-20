'use client'

import { useState, useEffect, Suspense } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'
import { User } from '@supabase/supabase-js'

declare global {
  interface Window {
    Razorpay: any;
  }
}

// Simple loading component for Suspense
function LoadingPurchase() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin text-4xl text-yellow-400 mb-4">⟳</div>
        <div className="text-white">Loading purchase page...</div>
      </div>
    </div>
  )
}

// Main purchase page component
function PurchasePageContent() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [creditAmount, setCreditAmount] = useState(10)
  const searchParams = useSearchParams()
  const router = useRouter()

  const agentId = searchParams.get('agent_id') || ''
  const userAgentId = searchParams.get('user_agent_id') || ''
  const agentName = searchParams.get('agent_name') || 'Unknown Agent'
  const creditCost = parseFloat(searchParams.get('credit_cost') || '1')
  const isNewPurchase = searchParams.get('new_purchase') === 'true'

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    checkUser()
    
    // Load Razorpay script
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)

    return () => {
      if (script.parentNode) {
        document.body.removeChild(script)
      }
    }
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }
    setUser(user)
  }

  const totalAmount = creditAmount * creditCost

  const handlePayment = async () => {
    if (!window.Razorpay) {
      alert('Razorpay not loaded. Please refresh and try again.')
      return
    }

    setLoading(true)
    console.log('🚀 Starting payment process...')

    try {
      // Create order first
      console.log('📦 Creating Razorpay order...')
      const orderResponse = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: `agent_${agentId}`,
          agentId: agentId,
          agentName: agentName,
          credits: creditAmount,
          amount: totalAmount,
          currency: 'INR',
          userId: user?.id
        })
      })

      const orderData = await orderResponse.json()
      console.log('📋 Order response:', orderData)
      
      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Failed to create order')
      }

      console.log('✅ Order created successfully, opening Razorpay...')

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: Math.round(totalAmount * 100), // Amount in paise
        currency: 'INR',
        name: 'AI Agent Marketplace',
        description: `${creditAmount} credits for ${agentName}`,
        order_id: orderData.orderId,
        prefill: {
          name: user?.user_metadata?.full_name || '',
          email: user?.email || '',
        },
        notes: {
          agent_id: agentId,
          agent_name: agentName,
          credits: creditAmount.toString(),
          user_id: user?.id
        },
        // **CRITICAL FIX** - Enhanced handler with better logging and error handling
        handler: async (response: any) => {
          console.log('🔥 Payment successful! Starting verification...', response)
          console.log('📋 Payment response details:', {
            order_id: response.razorpay_order_id,
            payment_id: response.razorpay_payment_id,
            signature_present: !!response.razorpay_signature
          })
          
          try {
            // Call verification endpoint with detailed logging
            console.log('📡 Calling verification API...')
            const verifyResponse = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              })
            })

            console.log('📡 Verification response status:', verifyResponse.status)
            
            let verifyData
            try {
              verifyData = await verifyResponse.json()
              console.log('📋 Verification data:', verifyData)
            } catch (parseError) {
              console.error('❌ Failed to parse verification response:', parseError)
              throw new Error('Server response was not valid JSON')
            }
            
            if (verifyResponse.ok && verifyData.success) {
              console.log('✅ Verification successful! Redirecting...')
              alert('🎉 Payment successful! Agent purchased successfully. Redirecting to dashboard...')
              
              // Force redirect after a short delay
              setTimeout(() => {
                window.location.href = '/dashboard?payment=success'
              }, 1000)
            } else {
              console.error('❌ Verification failed:', verifyData)
              alert(`❌ Payment verification failed: ${verifyData.error || 'Unknown error'}. Please contact support with payment ID: ${response.razorpay_payment_id}`)
            }
          } catch (verifyError) {
            console.error('❌ Verification network error:', verifyError)
            alert(`❌ Payment verification failed due to network error. Please contact support with payment ID: ${response.razorpay_payment_id}`)
          } finally {
            // Always reset loading state
            setLoading(false)
          }
        },
        modal: {
          ondismiss: () => {
            console.log('❌ Payment modal closed by user')
            setLoading(false)
          }
        },
        theme: {
          color: '#8B5CF6'
        }
      }

      console.log('🚀 Opening Razorpay with options:', options)
      const rzp = new window.Razorpay(options)
      rzp.open()

    } catch (error) {
      console.error('❌ Payment initiation failed:', error)
      alert('Failed to initiate payment. Please try again.')
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl text-yellow-400 mb-4">⟳</div>
          <div className="text-white">Checking authentication...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-yellow-400 mb-2">
            ◉ PURCHASE CREDITS ◉
          </h1>
          <p className="text-gray-400">for {agentName}</p>
        </div>

        {/* Agent Card */}
        <div className="bg-gray-900 border-2 border-purple-500 rounded-lg p-6 mb-6">
          {/* Agent Header */}
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 border-2 border-cyan-400 rounded flex items-center justify-center mr-4">
              <span className="text-xl">🤖</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-cyan-400">{agentName}</h2>
              <div className="text-sm text-gray-400">
                {isNewPurchase ? 'Initial Purchase' : 'Credit Top-up'}
              </div>
            </div>
          </div>

          {/* Purchase Details */}
          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Cost per Credit:</span>
              <span className="text-yellow-400 font-bold">₹{creditCost}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Credits to Purchase:</span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setCreditAmount(Math.max(1, creditAmount - 10))}
                  className="w-10 h-10 border border-gray-500 text-gray-400 hover:bg-gray-800 transition-colors"
                  disabled={loading}
                >
                  -
                </button>
                <span className="text-white font-bold text-xl w-20 text-center">
                  {creditAmount}
                </span>
                <button
                  onClick={() => setCreditAmount(creditAmount + 10)}
                  className="w-10 h-10 border border-gray-500 text-gray-400 hover:bg-gray-800 transition-colors"
                  disabled={loading}
                >
                  +
                </button>
              </div>
            </div>

            <div className="border-t border-gray-600 pt-4">
              <div className="flex justify-between items-center text-xl">
                <span className="text-gray-400">Total Amount:</span>
                <span className="text-yellow-400 font-bold">₹{totalAmount}</span>
              </div>
            </div>
          </div>

          {/* Payment Button */}
          <button
            onClick={handlePayment}
            disabled={loading}
            className="w-full py-4 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 text-black font-bold text-lg border-2 border-yellow-400 transition-colors"
          >
            {loading ? 'PROCESSING PAYMENT...' : 'PROCEED TO PAYMENT'}
          </button>

          {/* Security Notice */}
          <div className="mt-6 text-xs text-gray-500 text-center">
            <p>🔒 Secure payment powered by Razorpay</p>
            <p>Your payment information is encrypted and secure</p>
          </div>
        </div>

        {/* Quick Purchase Options */}
        <div className="mt-6 bg-gray-900 border border-purple-500 rounded-lg p-6">
          <h3 className="text-lg text-purple-400 mb-4">◉ QUICK PURCHASE ◉</h3>
          <div className="grid grid-cols-3 gap-3">
            {[10, 50, 100].map(amount => (
              <button
                key={amount}
                onClick={() => setCreditAmount(amount)}
                className={`py-2 px-4 border transition-colors ${
                  creditAmount === amount
                    ? 'border-purple-400 bg-purple-900/20 text-purple-400'
                    : 'border-gray-600 text-gray-400 hover:border-gray-400'
                }`}
                disabled={loading}
              >
                {amount}
              </button>
            ))}
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-6 text-center">
          <button 
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={loading}
          >
            ← Back to Agent
          </button>
        </div>
      </div>
    </div>
  )
}

// Export with Suspense wrapper
export default function PurchasePage() {
  return (
    <Suspense fallback={<LoadingPurchase />}>
      <PurchasePageContent />
    </Suspense>
  )
}