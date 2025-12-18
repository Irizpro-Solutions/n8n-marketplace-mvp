// COMPLETE PURCHASE PAGE FIXES 
// Fix all issues: pricing, currency detection, credit counter

'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

// Add proper agent pricing interface
interface Agent {
  id: string
  name: string
  description: string
  credit_cost: number
  category: string
  pricing_config?: {
    basePrice: number
    customPrices?: { [currency: string]: number }
  }
  // ... other fields
}

// Currency configuration
const CURRENCIES = {
  INR: { symbol: '₹', name: 'Indian Rupee', rate: 1 },
  USD: { symbol: '$', name: 'US Dollar', rate: 0.012 },
  AED: { symbol: 'د.إ', name: 'UAE Dirham', rate: 0.044 },
  EUR: { symbol: '€', name: 'Euro', rate: 0.011 }
}

// Helper functions
function getAgentPrice(agent: Agent, currency: string = 'INR'): number {
  // First check for new pricing_config
  if (agent.pricing_config) {
    // Check for custom price first
    if (agent.pricing_config.customPrices && agent.pricing_config.customPrices[currency]) {
      return agent.pricing_config.customPrices[currency]
    }
    
    // Return base price for INR
    if (currency === 'INR') {
      return agent.pricing_config.basePrice
    }
    
    // Auto-convert for other currencies
    const rate = CURRENCIES[currency as keyof typeof CURRENCIES]?.rate || 1
    return Math.round(agent.pricing_config.basePrice * rate * 100) / 100
  }
  
  // Fallback to old credit_cost field with conversion
  const basePrice = agent.credit_cost || 50
  if (currency === 'INR') return basePrice
  
  const rate = CURRENCIES[currency as keyof typeof CURRENCIES]?.rate || 1
  return Math.round(basePrice * rate * 100) / 100
}

function detectUserCurrency(): string {
  try {
    // Simple timezone-based detection
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    
    if (timezone.includes('Asia/Kolkata') || timezone.includes('Asia/Delhi')) return 'INR'
    if (timezone.includes('Asia/Dubai')) return 'AED'
    if (timezone.includes('America/')) return 'USD'
    if (timezone.includes('Europe/')) return 'EUR'
    
    return 'INR' // Default to INR
  } catch {
    return 'INR'
  }
}

function formatCurrency(amount: number, currency: string): string {
  const config = CURRENCIES[currency as keyof typeof CURRENCIES]
  if (!config) return `${amount} ${currency}`
  
  return `${config.symbol}${amount.toFixed(2)}`
}

// Main Purchase Component
export default function PurchasePage() {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [selectedCredits, setSelectedCredits] = useState(1)
  const [userCurrency, setUserCurrency] = useState('INR')
  const [showCurrencySelector, setShowCurrencySelector] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Auto-detect user currency
    setUserCurrency(detectUserCurrency())
    loadAgent()
  }, [])

  const loadAgent = async () => {
    try {
      // Get agent ID from URL params
      const urlParams = new URLSearchParams(window.location.search)
      const agentId = urlParams.get('agent_id')
      
      if (!agentId) {
        throw new Error('Agent ID not found')
      }

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single()

      if (error) throw error
      setAgent(data)
    } catch (error) {
      console.error('Error loading agent:', error)
    } finally {
      setLoading(false)
    }
  }

  // FIXED: Credit counter functions (increment by 1, not 10)
  const incrementCredits = () => {
    setSelectedCredits(prev => prev + 1)
  }

  const decrementCredits = () => {
    setSelectedCredits(prev => Math.max(1, prev - 1))
  }

  const handleCreditChange = (value: string) => {
    const num = parseInt(value) || 1
    setSelectedCredits(Math.max(1, num))
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!agent) {
    return <div className="text-center py-8">Agent not found</div>
  }

  const agentPrice = getAgentPrice(agent, userCurrency)
  const totalAmount = agentPrice * selectedCredits
  const currencyConfig = CURRENCIES[userCurrency as keyof typeof CURRENCIES]

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white p-6">
      <div className="max-w-md mx-auto">
        <div className="bg-gray-800 border border-yellow-500 rounded-lg p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-yellow-400">◉ CREDIT PURCHASE TERMINAL ◉</h1>
          </div>

          {/* Agent Info */}
          <div className="bg-gray-700 rounded p-4 mb-6">
            <h2 className="text-lg font-bold text-cyan-400">{agent.name}</h2>
            <p className="text-gray-300 text-sm">Initial Purchase</p>
          </div>

          {/* Currency Display - FIXED: Auto-detected, not selector by default */}
          <div className="bg-gray-700 rounded p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-green-400">💰 {currencyConfig.symbol}</span>
                <span className="text-lg font-medium">{userCurrency}</span>
                <span className="text-sm text-gray-400">{currencyConfig.name}</span>
              </div>
              {/* Small change currency button */}
              <button 
                onClick={() => setShowCurrencySelector(!showCurrencySelector)}
                className="text-blue-400 text-sm hover:underline"
              >
                Change Currency
              </button>
            </div>

            {/* Currency Selector - Only show when requested */}
            {showCurrencySelector && (
              <div className="mt-3 pt-3 border-t border-gray-600">
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(CURRENCIES).map(([code, config]) => (
                    <button
                      key={code}
                      onClick={() => {
                        setUserCurrency(code)
                        setShowCurrencySelector(false)
                      }}
                      className={`p-2 rounded border text-sm ${
                        userCurrency === code 
                          ? 'border-yellow-400 bg-yellow-400/20 text-yellow-400' 
                          : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      {config.symbol} {code}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pricing Display - FIXED: Shows correct price */}
          <div className="space-y-4 mb-6">
            <div className="flex justify-between">
              <span>Cost per Credit:</span>
              <span className="text-yellow-400 font-bold">
                {formatCurrency(agentPrice, userCurrency)}/credit
              </span>
            </div>

            {/* Credit Counter - FIXED: Increments by 1 */}
            <div className="flex justify-between items-center">
              <span>Credits to Purchase:</span>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={decrementCredits}
                  className="w-8 h-8 bg-gray-600 hover:bg-gray-500 rounded flex items-center justify-center text-lg font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  value={selectedCredits}
                  onChange={(e) => handleCreditChange(e.target.value)}
                  className="w-16 text-center bg-gray-700 border border-gray-600 rounded px-2 py-1"
                  min="1"
                />
                <button 
                  onClick={incrementCredits}
                  className="w-8 h-8 bg-gray-600 hover:bg-gray-500 rounded flex items-center justify-center text-lg font-bold"
                >
                  +
                </button>
              </div>
            </div>

            {/* Total Amount */}
            <div className="flex justify-between text-lg font-bold border-t border-gray-600 pt-4">
              <span>Total Amount:</span>
              <span className="text-yellow-400">
                {formatCurrency(totalAmount, userCurrency)}
              </span>
            </div>
          </div>

          {/* Payment Button */}
          <button className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold py-4 rounded-lg text-lg transition-colors">
            PAY {formatCurrency(totalAmount, userCurrency)}
          </button>

          {/* Powered by */}
          <div className="text-center mt-4">
            <p className="text-xs text-gray-500">
              🔒 Secure payments powered by Razorpay
            </p>
          </div>
        </div>

        {/* Quick Purchase Section */}
        <div className="mt-6 bg-gray-800 border border-purple-500 rounded-lg p-6">
          <h3 className="text-lg font-bold text-purple-400 mb-4">◉ QUICK PURCHASE ◉</h3>
          <div className="grid grid-cols-3 gap-3">
            {[10, 50, 100].map(credits => (
              <button
                key={credits}
                onClick={() => setSelectedCredits(credits)}
                className="bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium transition-colors"
              >
                {credits} Credits
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}