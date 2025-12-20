'use client'

import { useState, useEffect, Suspense } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { User } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import Script from 'next/script'

// Extend Window interface for Razorpay
declare global {
  interface Window {
    Razorpay: any
  }
}

interface Agent {
  id: string
  name: string
  description: string
  credit_cost: number
  category: string
  icon_url?: string
  pricing_config?: any
}

interface CreditPackage {
  id: string
  name: string
  credits: number
  price_inr: number
  price_usd: number
  description?: string
}

// Loading component for Suspense fallback
function PurchasePageSkeleton() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin text-4xl text-yellow-400 mb-4">⟳</div>
        <div className="text-white">Loading purchase details...</div>
      </div>
    </div>
  )
}

// Main purchase component that uses useSearchParams
function PurchasePageContent() {
  const [user, setUser] = useState<User | null>(null)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([])
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR')
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const agentId = searchParams.get('agent_id')
  const agentName = searchParams.get('agent_name') || 'AI Agent'

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    checkUserAndLoadData()
  }, [agentId])

  const checkUserAndLoadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/auth/login')
        return
      }
      
      setUser(user)
      
      if (agentId) {
        await loadAgentData(agentId)
      }
      
      await loadCreditPackages()
      
    } catch (error) {
      console.error('Error loading data:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const loadAgentData = async (agentId: string) => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single()

      if (error) throw error
      setAgent(data)

      // Auto-detect currency from pricing config
      if (data.pricing_config?.default_currency) {
        setCurrency(data.pricing_config.default_currency)
      }
    } catch (error) {
      console.error('Error loading agent:', error)
    }
  }

  const loadCreditPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('credit_packages')
        .select('*')
        .eq('is_active', true)
        .order('credits', { ascending: true })

      if (error) throw error
      setCreditPackages(data || [])
      
      // Set default package
      if (data && data.length > 0) {
        setSelectedPackage(data[0])
      }
    } catch (error) {
      console.error('Error loading credit packages:', error)
    }
  }

  // **FIXED PAYMENT HANDLER** - This is the critical fix!
  const handlePayment = async () => {
    if (!user || !agent) {
      alert('User or agent information missing')
      return
    }

    if (!selectedPackage) {
      alert('Please select a credit package')
      return
    }

    if (!window.Razorpay) {
      alert('Razorpay not loaded. Please refresh and try again.')
      return
    }

    setPaymentProcessing(true)

    try {
      console.log('🎯 Creating Razorpay order...')
      
      // Create order first
      const orderResponse = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: selectedPackage.id,
          agentId: agent.id,
          agentName: agent.name,
          credits: selectedPackage.credits,
          amount: currency === 'INR' ? selectedPackage.price_inr : selectedPackage.price_usd,
          currency: currency,
          userId: user.id
        })
      })

      const orderData = await orderResponse.json()
      console.log('📦 Order created:', orderData)

      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Failed to create order')
      }

      // **CRITICAL FIX**: Proper Razorpay options with verification handler
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: currency === 'INR' 
          ? Math.round(selectedPackage.price_inr * 100) // Convert to paise
          : Math.round(selectedPackage.price_usd * 100), // Convert to cents
        currency: currency,
        name: 'AI Agent Marketplace',
        description: `${selectedPackage.credits} credits for ${agent.name}`,
        order_id: orderData.orderId,
        prefill: {
          email: user.email,
          name: user.user_metadata?.full_name || user.email
        },
        notes: {
          agent_id: agent.id,
          agent_name: agent.name,
          package_id: selectedPackage.id,
          credits: selectedPackage.credits.toString(),
          user_id: user.id
        },
        // **THIS IS THE KEY FIX** - Proper handler function that calls verification
        handler: async function (response: any) {
          console.log('✅ Payment successful! Verifying...', response)
          
          try {
            // Call your verification endpoint
            const verifyResponse = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              })
            })

            const verifyData = await verifyResponse.json()
            console.log('🔍 Verification result:', verifyData)
            
            if (verifyResponse.ok && verifyData.success) {
              // Success! Alert and redirect
              alert('🎉 Payment successful! Agent purchased successfully. Redirecting to dashboard...')
              router.push('/dashboard?payment=success')
            } else {
              console.error('❌ Verification failed:', verifyData)
              alert(`❌ Payment verification failed: ${verifyData.error || 'Unknown error'}. Please contact support with payment ID: ${response.razorpay_payment_id}`)
            }
          } catch (verifyError) {
            console.error('❌ Verification error:', verifyError)
            alert(`❌ Payment verification failed. Please contact support with payment ID: ${response.razorpay_payment_id}`)
          } finally {
            // Always reset loading state
            setPaymentProcessing(false)
          }
        },
        modal: {
          ondismiss: function() {
            console.log('❌ Payment modal closed by user')
            setPaymentProcessing(false)
          }
        },
        theme: {
          color: '#EAB308' // Yellow theme matching your site
        }
      }

      console.log('🚀 Opening Razorpay with options:', options)
      const rzp = new window.Razorpay(options)
      rzp.open()

    } catch (error) {
      console.error('❌ Payment initiation failed:', error)
      alert('Failed to initiate payment. Please try again.')
      setPaymentProcessing(false)
    }
  }

  const totalAmount = selectedPackage 
    ? (currency === 'INR' ? selectedPackage.price_inr : selectedPackage.price_usd)
    : 0

  if (loading) {
    return <PurchasePageSkeleton />
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-2xl mb-4">❌</div>
          <div className="text-white">Agent not found</div>
          <button 
            onClick={() => router.push('/browse')}
            className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white border border-purple-400"
          >
            Back to Browse
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Load Razorpay Script */}
      <Script 
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      <div className="min-h-screen bg-black text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-yellow-400 mb-2">
              ◉ PURCHASE AGENT CREDITS ◉
            </h1>
            <p className="text-gray-400">Secure payment powered by Razorpay</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Agent Details */}
            <div className="border-2 border-cyan-400 bg-cyan-900/10 rounded-lg p-6">
              <h2 className="text-xl text-cyan-400 font-bold mb-4">◉ AGENT DETAILS</h2>
              
              <div className="flex items-center mb-4">
                <div className="w-16 h-16 border-2 border-cyan-400 rounded flex items-center justify-center mr-4">
                  <span className="text-2xl">🤖</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{agent.name}</h3>
                  <div className="text-sm text-gray-400">{agent.category}</div>
                </div>
              </div>

              <p className="text-gray-300 mb-4">{agent.description}</p>
              
              <div className="bg-black/40 border border-gray-600 rounded p-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Cost per execution:</span>
                  <span className="text-yellow-400 font-bold">{agent.credit_cost} credits</span>
                </div>
              </div>
            </div>

            {/* Purchase Form */}
            <div className="border-2 border-yellow-400 bg-yellow-900/10 rounded-lg p-6">
              <h2 className="text-xl text-yellow-400 font-bold mb-4">◉ PURCHASE OPTIONS</h2>
              
              {/* Currency Selector */}
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">Currency:</label>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrency('INR')}
                    className={`px-4 py-2 border-2 transition-colors ${
                      currency === 'INR'
                        ? 'border-yellow-400 bg-yellow-900/20 text-yellow-400'
                        : 'border-gray-600 text-gray-400'
                    }`}
                  >
                    INR (₹)
                  </button>
                  <button
                    onClick={() => setCurrency('USD')}
                    className={`px-4 py-2 border-2 transition-colors ${
                      currency === 'USD'
                        ? 'border-yellow-400 bg-yellow-900/20 text-yellow-400'
                        : 'border-gray-600 text-gray-400'
                    }`}
                  >
                    USD ($)
                  </button>
                </div>
              </div>

              {/* Credit Package Selection */}
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">Select Credit Package:</label>
                <div className="space-y-2">
                  {creditPackages.map((pkg) => (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPackage(pkg)}
                      className={`w-full p-4 border-2 rounded text-left transition-colors ${
                        selectedPackage?.id === pkg.id
                          ? 'border-yellow-400 bg-yellow-900/20'
                          : 'border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-bold text-white">{pkg.name}</div>
                          <div className="text-sm text-gray-400">{pkg.credits} credits</div>
                          {pkg.description && (
                            <div className="text-xs text-gray-500">{pkg.description}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-yellow-400">
                            {currency === 'INR' ? `₹${pkg.price_inr}` : `$${pkg.price_usd}`}
                          </div>
                          <div className="text-xs text-gray-400">
                            ~{Math.floor(pkg.credits / agent.credit_cost)} executions
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Summary */}
              {selectedPackage && (
                <div className="bg-black/40 border border-yellow-400 rounded p-4 mb-6">
                  <h3 className="text-yellow-400 font-bold mb-2">Payment Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Package:</span>
                      <span className="text-white">{selectedPackage.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Credits:</span>
                      <span className="text-white">{selectedPackage.credits}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Possible Executions:</span>
                      <span className="text-white">{Math.floor(selectedPackage.credits / agent.credit_cost)}</span>
                    </div>
                    <hr className="border-gray-600" />
                    <div className="flex justify-between font-bold">
                      <span className="text-gray-300">Total Amount:</span>
                      <span className="text-yellow-400 text-lg">
                        {currency === 'INR' ? `₹${selectedPackage.price_inr}` : `$${selectedPackage.price_usd}`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Purchase Button */}
              <button
                onClick={handlePayment}
                disabled={!selectedPackage || paymentProcessing}
                className="w-full py-4 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-bold border-2 border-yellow-400 transition-colors text-lg"
              >
                {paymentProcessing ? 'PROCESSING...' : `PAY ${currency === 'INR' ? `₹${totalAmount}` : `$${totalAmount}`} & PURCHASE`}
              </button>

              <div className="text-xs text-gray-400 text-center mt-4">
                ✓ Secure payment powered by Razorpay<br/>
                ✓ 256-bit SSL encryption<br/>
                ✓ Instant credit activation
              </div>
            </div>
          </div>

          {/* Back Button */}
          <div className="text-center mt-8">
            <button 
              onClick={() => router.push('/browse')}
              className="px-6 py-2 border-2 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-colors"
            >
              ← Back to Marketplace
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// **MAIN EXPORT WITH SUSPENSE BOUNDARY** - This fixes the Next.js 15 build error
export default function PurchasePage() {
  return (
    <Suspense fallback={<PurchasePageSkeleton />}>
      <PurchasePageContent />
    </Suspense>
  )
}