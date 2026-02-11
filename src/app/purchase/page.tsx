'use client'

import { useState, useEffect, Suspense } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { Bot, ShieldCheck } from 'lucide-react'
import ModernBackground from '@/components/layouts/ModernBackground'
import ModernHeader from '@/components/layouts/ModernHeader'
import { formatCurrency, getPriceAsync, type PricingConfig } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'

declare global {
  interface Window {
    Razorpay: any;
  }
}

// Simple loading component for Suspense
function LoadingPurchase() {
  return (
    <ModernBackground>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading purchase...</p>
        </div>
      </div>
    </ModernBackground>
  )
}

// Main purchase page component
function PurchasePageContent() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [creditAmount, setCreditAmount] = useState(1)
  const [agent, setAgent] = useState<{ id: string; name: string; credit_cost: number; pricing_config?: PricingConfig } | null>(null)
  const [creditCost, setCreditCost] = useState<number>(0)
  const [agentLoading, setAgentLoading] = useState(true)
  const searchParams = useSearchParams()
  const router = useRouter()
  const { currency, loading: currencyLoading } = useCurrency()

  const agentId = searchParams.get('agent_id') || ''
  const userAgentId = searchParams.get('user_agent_id') || ''
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

  // Fetch agent data from API
  useEffect(() => {
    if (!agentId) return
    const loadAgent = async () => {
      try {
        setAgentLoading(true)
        const response = await fetch(`/api/agents/${agentId}`)
        if (!response.ok) throw new Error('Agent not found')
        const result = await response.json()
        if (!result.success || !result.data) throw new Error('Invalid agent data')
        setAgent(result.data)
      } catch (error) {
        console.error('Failed to load agent:', error)
        router.push('/browse')
      } finally {
        setAgentLoading(false)
      }
    }
    loadAgent()
  }, [agentId, router])

  // Calculate price when agent + currency are ready
  useEffect(() => {
    if (!agent || currencyLoading) return
    const calculatePrice = async () => {
      const pricingConfig = agent.pricing_config || { basePrice: agent.credit_cost }
      const price = await getPriceAsync(pricingConfig, currency)
      setCreditCost(price)
    }
    calculatePrice()
  }, [agent, currency, currencyLoading])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }
    setUser(user)
  }

  const totalAmount = creditAmount * creditCost
  const agentName = agent?.name || 'Loading...'

  // Separate async function for payment verification
  const verifyPaymentAsync = async (response: any) => {
    try {
      console.log('Starting payment verification API call...')

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
          packageId: `agent_${agentId}`,
          credits: creditAmount,
          currency: currency,
        })
      })

      console.log('Verification response status:', verifyResponse.status)

      let verifyData
      try {
        verifyData = await verifyResponse.json()
        console.log('Verification response data:', verifyData)
      } catch (parseError) {
        console.error('Failed to parse verification response:', parseError)
        const text = await verifyResponse.text()
        console.error('Response text:', text.substring(0, 500))
        throw new Error('Server response was not valid JSON')
      }

      if (verifyResponse.ok && verifyData.success) {
        console.log('Payment verified successfully!')
        console.log('Credits added:', verifyData.data?.credits_added)
        console.log('New balance:', verifyData.data?.new_balance)

        alert('Payment successful! Agent purchased successfully. Redirecting to dashboard...')

        // Redirect to dashboard with success parameter
        setTimeout(() => {
          console.log('Redirecting to dashboard...')
          window.location.href = '/dashboard?payment=success'
        }, 1500)
      } else {
        console.error('Verification failed:', verifyData)
        alert(`Payment verification failed: ${verifyData.error || 'Unknown error'}. Please contact support with payment ID: ${response.razorpay_payment_id}`)
        setLoading(false)
      }
    } catch (verifyError: any) {
      console.error('Verification error:', verifyError)
      alert(`Payment verification failed: ${verifyError.message}. Please contact support with payment ID: ${response.razorpay_payment_id}`)
      setLoading(false)
    }
  }

  const handlePayment = async () => {
    if (!window.Razorpay) {
      alert('Razorpay not loaded. Please refresh and try again.')
      return
    }

    setLoading(true)
    console.log('Starting payment process...')

    try {
      // Create order (server computes amount from agent pricing)
      console.log('Creating Razorpay order...')
      const orderResponse = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agentId,
          credits: creditAmount,
          currency: currency,
        })
      })

      const orderData = await orderResponse.json()
      console.log('Order response:', orderData)

      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Failed to create order')
      }

      console.log('Order created successfully, opening Razorpay...')

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,       // Server-validated amount in paise
        currency: orderData.currency,   // Server-validated currency
        name: 'AI Agent Marketplace',
        description: `${creditAmount} credits for ${agentName}`,
        order_id: orderData.orderId,
        prefill: {
          name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || '',
          email: user?.email || '',
        },
        notes: {
          agent_id: agentId,
          agent_name: agentName,
          credits: creditAmount.toString(),
          user_id: user?.id
        },
        // **CRITICAL FIX** - Synchronous handler for Razorpay success animation
        handler: (response: any) => {
          console.log('Payment successful! Handler triggered', response)
          console.log('Payment response details:', {
            order_id: response.razorpay_order_id,
            payment_id: response.razorpay_payment_id,
            signature_present: !!response.razorpay_signature
          })

          // Validate response has required fields
          if (!response.razorpay_order_id || !response.razorpay_payment_id || !response.razorpay_signature) {
            console.error('Invalid payment response from Razorpay', response)
            alert('Payment response invalid. Please contact support.')
            setLoading(false)
            return
          }

          // Show success message immediately (allows Razorpay animation to complete)
          console.log('Payment captured by Razorpay, starting verification...')

          // Run verification in background (non-blocking to allow Razorpay animation)
          setTimeout(() => {
            verifyPaymentAsync(response)
          }, 100)
        },
        modal: {
          ondismiss: () => {
            console.log('Payment modal closed by user')
            setLoading(false)
          },
          // Prevent accidental closure during payment
          escape: false,
          backdropclose: false,
        },
        theme: {
          color: '#8B5CF6'
        },
        // Retry configuration
        retry: {
          enabled: true,
          max_count: 3
        }
      }

      console.log('Opening Razorpay with options:', options)
      const rzp = new window.Razorpay(options)
      rzp.open()

    } catch (error) {
      console.error('Payment initiation failed:', error)
      alert('Failed to initiate payment. Please try again.')
      setLoading(false)
    }
  }

  if (!user || agentLoading || currencyLoading || !agent) {
    return (
      <ModernBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading purchase details...</p>
          </div>
        </div>
      </ModernBackground>
    )
  }

  return (
    <ModernBackground>
      <ModernHeader user={user} />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              Purchase Credits
            </h1>
            <p className="text-gray-400 text-lg">for {agentName}</p>
          </div>

          {/* Main Purchase Card */}
          <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-8 mb-6 shadow-xl shadow-purple-500/5">
            {/* Agent Header */}
            <div className="flex items-center mb-6 pb-6 border-b border-white/10">
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center mr-4">
                <Bot className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{agentName}</h2>
                <div className="text-sm text-gray-400">
                  {isNewPurchase ? 'Initial Purchase' : 'Credit Top-up'}
                </div>
              </div>
            </div>

            {/* Purchase Details */}
            <div className="space-y-6 mb-8">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Cost per Credit:</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">{formatCurrency(creditCost, currency)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-medium">Credits to Purchase:</span>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setCreditAmount(Math.max(1, creditAmount - 1))}
                    className="w-10 h-10 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                    disabled={loading || creditAmount <= 1}
                  >
                    −
                  </button>
                  <span className="text-white font-bold text-2xl w-20 text-center">
                    {creditAmount}
                  </span>
                  <button
                    onClick={() => setCreditAmount(Math.min(30, creditAmount + 1))}
                    className="w-10 h-10 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                    disabled={loading || creditAmount >= 30}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="border-t border-white/10 pt-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-lg">Total Amount:</span>
                  <span className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">{formatCurrency(totalAmount, currency)}</span>
                </div>
              </div>
            </div>

            {/* Quick Purchase Options */}
            <div className="mb-8">
              <h3 className="text-sm text-gray-400 mb-3">Quick Select:</h3>
              <div className="grid grid-cols-3 gap-3">
                {[5, 10, 15, 20, 25, 30].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setCreditAmount(amount)}
                    className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                      creditAmount === amount
                        ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg shadow-purple-500/50'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                    disabled={loading}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Button */}
            <button
              onClick={handlePayment}
              disabled={loading || creditCost <= 0}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-lg rounded-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing Payment...
                </span>
              ) : (
                'Proceed to Payment'
              )}
            </button>

            {/* Security Notice */}
            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-green-200 text-sm flex items-center justify-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                Secure payment powered by Razorpay
              </p>
            </div>
          </div>

          {/* Back Button */}
          <div className="text-center">
            <button
              onClick={() => router.back()}
              className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 mx-auto"
              disabled={loading}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Agents
            </button>
          </div>
        </div>
      </div>
    </ModernBackground>
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
