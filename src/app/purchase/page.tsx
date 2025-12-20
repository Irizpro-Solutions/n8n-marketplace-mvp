'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { User } from '@supabase/supabase-js'

interface Agent {
  id: string
  name: string
  description: string
  category: string
  credit_cost: number
  pricing_config: {
    INR: { price: number }
    USD: { price: number }
    AED: { price: number }
    EUR: { price: number }
  }
  icon_url?: string
}

interface PricingOption {
  credits: number
  label: string
  isPopular?: boolean
}

export default function PurchasePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const agentId = searchParams.get('agent_id')
  const agentName = searchParams.get('agent_name')
  const credits = searchParams.get('credits')
  
  const [user, setUser] = useState<User | null>(null)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [selectedCredits, setSelectedCredits] = useState(10)
  const [currency, setCurrency] = useState('INR')
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const pricingOptions: PricingOption[] = [
    { credits: 10, label: 'Starter Pack' },
    { credits: 25, label: 'Popular', isPopular: true },
    { credits: 50, label: 'Pro Pack' },
    { credits: 100, label: 'Enterprise' }
  ]

  useEffect(() => {
    initializePage()
  }, [])

  const initializePage = async () => {
    try {
      // Check authentication
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      setUser(user)

      // Load agent data
      if (agentId) {
        const { data, error } = await supabase
          .from('agents')
          .select('*')
          .eq('id', agentId)
          .single()

        if (error || !data) {
          console.error('Error loading agent:', error)
          router.push('/browse')
          return
        }
        setAgent(data)
      }

      // Set initial credits from URL
      if (credits) {
        setSelectedCredits(parseInt(credits))
      }

    } catch (error) {
      console.error('Error initializing page:', error)
      router.push('/browse')
    } finally {
      setLoading(false)
    }
  }

  const getPrice = (credits: number): number => {
    if (!agent?.pricing_config) return credits * 5 // Fallback
    
    const pricing = agent.pricing_config[currency as keyof typeof agent.pricing_config]
    return pricing ? credits * pricing.price : credits * 5
  }

  const handlePayment = async () => {
    if (!agent || !user) return

    setPaymentProcessing(true)

    try {
      console.log('🚀 Initiating payment for:', {
        agent: agent.name,
        credits: selectedCredits,
        currency
      })

      // Calculate total amount
      const totalAmount = getPrice(selectedCredits)

      // Create Razorpay order
      const orderResponse = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agent.id,
          credits: selectedCredits,
          amount: totalAmount,
          currency,
          user_id: user.id
        })
      })

      const orderData = await orderResponse.json()
      console.log('📋 Order response:', orderData)

      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Failed to create order')
      }

      // Load Razorpay script
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => openRazorpayModal(orderData)
      document.body.appendChild(script)

    } catch (error) {
      console.error('❌ Payment initiation error:', error)
      alert('Payment initiation failed. Please try again.')
      setPaymentProcessing(false)
    }
  }

  const openRazorpayModal = (orderData: any) => {
    const totalAmount = getPrice(selectedCredits)
    
    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: totalAmount * 100, // Razorpay expects amount in paisa
      currency: currency,
      name: 'AI Agent Marketplace',
      description: `${selectedCredits} credits for ${agent?.name}`,
      order_id: orderData.orderId,
      prefill: {
        email: user?.email,
        name: user?.user_metadata?.full_name || user?.email
      },
      notes: {
        agent_id: agent?.id,
        agent_name: agent?.name,
        credits: selectedCredits.toString(),
        user_id: user?.id
      },
      // 🔥 CRITICAL: This handler is called after successful payment
      handler: async function (response: any) {
        console.log('✅ Payment successful! Response:', response)
        
        try {
          console.log('📡 Calling verification API...')
          
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
          console.log('📋 Verification response:', verifyData)
          
          if (verifyResponse.ok && verifyData.success) {
            console.log('✅ Payment verified successfully!')
            alert('✅ Payment successful! Agent purchased successfully. Redirecting to dashboard...')
            
            // Give user time to see the success message
            setTimeout(() => {
              router.push('/dashboard')
            }, 2000)
          } else {
            console.error('❌ Verification failed:', verifyData)
            alert(`❌ Payment verification failed: ${verifyData.error || 'Unknown error'}. Please contact support with order ID: ${response.razorpay_order_id}`)
          }
        } catch (error) {
          console.error('❌ Verification error:', error)
          alert(`❌ Payment verification failed. Please contact support with order ID: ${response.razorpay_order_id}`)
        } finally {
          setPaymentProcessing(false)
        }
      },
      modal: {
        // This is called when user closes the modal
        ondismiss: function() {
          console.log('🚫 Payment modal closed by user')
          setPaymentProcessing(false)
        }
      },
      theme: {
        color: '#EAB308' // Yellow theme to match your design
      }
    }

    console.log('💳 Opening Razorpay modal with options:', options)
    
    // Open Razorpay modal
    const rzp = new (window as any).Razorpay(options)
    rzp.open()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⟳</div>
          <div className="text-white">Loading purchase page...</div>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">Agent not found</div>
          <button 
            onClick={() => router.push('/browse')}
            className="px-6 py-2 bg-blue-600 text-white rounded"
          >
            Back to Browse
          </button>
        </div>
      </div>
    )
  }

  const totalAmount = getPrice(selectedCredits)

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 py-4">
        <div className="max-w-6xl mx-auto px-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-yellow-400">◉ PURCHASE AGENT ◉</h1>
          <button
            onClick={() => router.push('/browse')}
            className="px-4 py-2 border border-gray-600 hover:bg-gray-800 transition-colors"
          >
            ← BACK TO BROWSE
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Agent Info */}
        <div className="bg-gray-900 border-2 border-cyan-400 rounded-lg p-6 mb-8">
          <div className="flex items-center mb-4">
            <div className="w-16 h-16 border-2 border-cyan-400 rounded flex items-center justify-center mr-4">
              <span className="text-3xl">🤖</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-cyan-400">{agent.name}</h2>
              <div className="text-gray-400">{agent.category}</div>
            </div>
          </div>
          <p className="text-gray-300">{agent.description}</p>
          <div className="mt-4 text-sm text-yellow-400">
            Base Cost: ₹{agent.credit_cost} per execution
          </div>
        </div>

        {/* Pricing Selection */}
        <div className="bg-gray-900 border-2 border-yellow-400 rounded-lg p-6 mb-8">
          <h3 className="text-xl text-yellow-400 font-bold mb-4">SELECT CREDIT PACKAGE</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {pricingOptions.map((option) => (
              <button
                key={option.credits}
                onClick={() => setSelectedCredits(option.credits)}
                className={`p-4 border-2 rounded-lg transition-all ${
                  selectedCredits === option.credits
                    ? 'border-yellow-400 bg-yellow-400/20'
                    : 'border-gray-600 hover:border-gray-500'
                } ${option.isPopular ? 'ring-2 ring-green-400' : ''}`}
              >
                {option.isPopular && (
                  <div className="text-green-400 text-xs font-bold mb-1">POPULAR</div>
                )}
                <div className="text-white font-bold text-lg">{option.credits}</div>
                <div className="text-gray-400 text-sm">{option.label}</div>
                <div className="text-yellow-400 font-bold">₹{getPrice(option.credits)}</div>
              </button>
            ))}
          </div>

          {/* Custom Amount */}
          <div className="mb-6">
            <label className="block text-gray-400 mb-2">Custom Amount:</label>
            <input
              type="number"
              min="1"
              max="1000"
              value={selectedCredits}
              onChange={(e) => setSelectedCredits(parseInt(e.target.value) || 1)}
              className="w-full bg-black border border-gray-600 rounded px-4 py-2 text-white"
            />
          </div>

          {/* Currency Selection */}
          <div className="mb-6">
            <label className="block text-gray-400 mb-2">Currency:</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-black border border-gray-600 rounded px-4 py-2 text-white"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="AED">AED (د.إ)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>

          {/* Total Cost */}
          <div className="bg-black border border-yellow-400 rounded p-4 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-gray-400">Total Credits:</div>
                <div className="text-white font-bold text-xl">{selectedCredits}</div>
              </div>
              <div className="text-right">
                <div className="text-gray-400">Total Cost:</div>
                <div className="text-yellow-400 font-bold text-2xl">
                  {currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'AED' ? 'د.إ' : '€'}{totalAmount}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Button */}
          <button
            onClick={handlePayment}
            disabled={paymentProcessing}
            className="w-full py-4 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-black font-bold text-xl border-2 border-yellow-400 rounded transition-colors"
          >
            {paymentProcessing ? 'PROCESSING PAYMENT...' : `PAY ${currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'AED' ? 'د.إ' : '€'}${totalAmount}`}
          </button>
        </div>

        {/* Payment Info */}
        <div className="bg-gray-900 border border-gray-600 rounded-lg p-4 text-sm text-gray-400">
          <h4 className="text-white font-bold mb-2">Payment Information:</h4>
          <ul className="space-y-1">
            <li>• Secure payment powered by Razorpay</li>
            <li>• Credits will be added to your account immediately</li>
            <li>• You can use credits to execute this agent</li>
            <li>• No expiration on purchased credits</li>
          </ul>
        </div>
      </main>
    </div>
  )
}