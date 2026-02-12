'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { Bot } from 'lucide-react'
import ModernBackground from '@/components/layouts/ModernBackground'
import ModernHeader from '@/components/layouts/ModernHeader'
import { useCurrency } from '@/hooks/useCurrency'
import {
  getPriceAsync,
  formatCurrency,
  SUPPORTED_CURRENCIES,
  type PricingConfig
} from '@/lib/currency'

interface Agent {
  id: string
  name: string
  description: string
  credit_cost: number
  category: string
  icon_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
  pricing_config?: PricingConfig
}

interface PurchasedAgent {
  agent_id: string
  remaining_credits: number
}

export default function BrowseAgents() {
  const [user, setUser] = useState<User | null>(null)
  const [userCredits, setUserCredits] = useState<number>(0)
  const [agents, setAgents] = useState<Agent[]>([])
  const [purchasedAgents, setPurchasedAgents] = useState<PurchasedAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [agentPrices, setAgentPrices] = useState<Record<string, number>>({})
  const router = useRouter()

  // Currency detection hook
  const { currency, loading: currencyLoading } = useCurrency()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    checkUser()
    loadAgents()
  }, [])

  useEffect(() => {
    if (user) {
      loadPurchasedAgents()
      loadUserCredits()
    }
  }, [user])

  // Load pricing when currency is detected or agents change
  useEffect(() => {
    if (!currencyLoading && agents.length > 0) {
      loadPricing()
    }
  }, [currency, currencyLoading, agents])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  const loadAgents = async () => {
    try {
      // Fetch agents via secure API route (RLS-protected)
      const response = await fetch('/api/agents/list')
      if (!response.ok) throw new Error('Failed to fetch agents')

      const result = await response.json()
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch agents')
      }

      setAgents(result.data)
    } catch (error) {
      console.error('Error loading agents:', error)
      setAgents([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }

  const loadPurchasedAgents = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('user_agents')
        .select('agent_id, remaining_credits')
        .eq('user_id', user.id)

      if (error) throw error
      setPurchasedAgents(data || [])
    } catch (error) {
      console.error('Error loading purchased agents:', error)
    }
  }

  const loadUserCredits = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setUserCredits(data?.credits || 0)
    } catch (error) {
      console.error('Error loading user credits:', error)
    }
  }

  const loadPricing = async () => {
    if (currencyLoading || agents.length === 0) return

    console.log('[Browse] Loading pricing for currency:', currency)

    try {
      const prices: Record<string, number> = {}

      // Calculate price for each agent using real-time exchange rates
      for (const agent of agents) {
        // Use pricing_config if available, otherwise fallback to credit_cost
        const pricingConfig = agent.pricing_config || { basePrice: agent.credit_cost }

        // Get price with real-time exchange rate conversion
        prices[agent.id] = await getPriceAsync(pricingConfig, currency)
      }

      setAgentPrices(prices)
      console.log('[Browse] Pricing loaded:', { currency, agentCount: Object.keys(prices).length })
    } catch (error) {
      console.error('[Browse] Error loading pricing:', error)
      // Fallback: use credit_cost as-is
      const fallbackPrices: Record<string, number> = {}
      agents.forEach(agent => {
        fallbackPrices[agent.id] = agent.credit_cost
      })
      setAgentPrices(fallbackPrices)
    }
  }

  const categories = ['all', ...new Set(agents.map(agent => agent.category).filter(Boolean))]
  const filteredAgents = selectedCategory === 'all'
    ? agents
    : agents.filter(agent => agent.category === selectedCategory)

  const isPurchased = (agentId: string) => {
    return purchasedAgents.some(pa => pa.agent_id === agentId)
  }

  const getRemainingCredits = (agentId: string) => {
    const purchased = purchasedAgents.find(pa => pa.agent_id === agentId)
    return purchased?.remaining_credits || 0
  }

  const handlePurchase = (agent: Agent) => {
    if (!user) {
      // Store agent data for after login
      localStorage.setItem('pendingPurchase', JSON.stringify({
        agent_id: agent.id,
        new_purchase: 'true'
      }))
      router.push('/auth/login?redirect=purchase')
      return
    }

    const params = new URLSearchParams({
      agent_id: agent.id,
      new_purchase: 'true'
    })
    router.push(`/purchase?${params.toString()}`)
  }

  if (loading || currencyLoading) {
    return (
      <ModernBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-xl text-white font-medium">
              {loading ? 'Loading agents...' : 'Detecting your currency...'}
            </div>
          </div>
        </div>
      </ModernBackground>
    )
  }

  return (
    <ModernBackground>
      <ModernHeader user={user} credits={userCredits} />

      {/* Main Content */}
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Discover AI Agents
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Browse our marketplace of powerful automation workflows
            </p>
            {/* Currency Indicator */}
            {/* <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full">
              <span className="text-sm text-gray-400">Prices shown in</span>
              <span className="text-sm font-semibold text-cyan-400">
                {SUPPORTED_CURRENCIES[currency]?.name || currency}
              </span>
              <span className="text-sm text-gray-400">({SUPPORTED_CURRENCIES[currency]?.symbol || currency})</span>
            </div> */}
          </div>

          {/* Category Filter */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-3 justify-center">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-300 hover:scale-[1.02] ${
                    selectedCategory === category
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 scale-105'
                      : 'bg-white/5 backdrop-blur-sm border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20'
                  }`}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Agents Grid */}
          {filteredAgents.length === 0 ? (
            <div className="text-center py-16">
              <Bot className="w-16 h-16 text-gray-500 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-white mb-4">No Agents Found</h3>
              <p className="text-gray-400 mb-6">
                {selectedCategory === 'all'
                  ? 'No agents are currently available'
                  : `No agents found in "${selectedCategory}" category`
                }
              </p>

              {selectedCategory !== 'all' && (
                <button
                  onClick={() => setSelectedCategory('all')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
                >
                  View All Categories
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAgents.map((agent) => (
                <ModernAgentCard
                  key={agent.id}
                  agent={agent}
                  price={agentPrices[agent.id] || agent.credit_cost}
                  currency={currency}
                  isPurchased={user ? isPurchased(agent.id) : false}
                  remainingCredits={user ? getRemainingCredits(agent.id) : 0}
                  onPurchase={() => handlePurchase(agent)}
                  isLoggedIn={!!user}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </ModernBackground>
  )
}

interface ModernAgentCardProps {
  agent: Agent
  price: number
  currency: string
  isPurchased: boolean
  remainingCredits: number
  onPurchase: () => void
  isLoggedIn: boolean
}

function ModernAgentCard({ agent, price, currency, isPurchased, remainingCredits, onPurchase, isLoggedIn }: ModernAgentCardProps) {
  const isNew = new Date(agent.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  return (
    <div className="group relative bg-white/[0.06] border border-white/[0.08] rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] hover:border-white/[0.15] hover:shadow-xl hover:shadow-blue-500/5">
      {/* Status Badges */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        {isNew && (
          <div className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
            New
          </div>
        )}
        {isLoggedIn && isPurchased && (
          <div className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
            Owned
          </div>
        )}
      </div>

      {/* Agent Icon */}
      <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        <Bot className="w-7 h-7 text-white" />
      </div>

      {/* Category Badge */}
      <div className="inline-block px-3 py-1 bg-blue-500/10 text-blue-300 text-xs font-medium rounded-full mb-3">
        {agent.category}
      </div>

      {/* Agent Name */}
      <h3 className="text-xl font-bold text-white mb-2 leading-tight">{agent.name}</h3>

      {/* Description */}
      <p className="text-sm text-gray-400 mb-4 line-clamp-3">{agent.description}</p>

      {/* Pricing */}
      <div className="mb-4 p-4 bg-white/[0.02] border border-white/10 rounded-lg">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl fo  b  nt-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              {formatCurrency(price, currency)}
            </span>
            <span className="text-sm text-gray-400">/ execution</span>
          </div>
          {/* {currency !== 'INR' && (
            <div className="text-xs text-gray-500">
              ≈ ₹{agent.credit_cost} INR base price
            </div>
          )} */}
        </div>
      </div>

      {/* Action Button */}
      {isLoggedIn && isPurchased ? (
        <div className="space-y-2">
          <div className="w-full py-3 bg-green-500/20 text-green-400 border border-green-500/50 text-center rounded-lg font-semibold">
            ✓ Purchased
          </div>
          <div className="text-xs text-center text-gray-400">
            {remainingCredits} credits • View in Dashboard
          </div>
        </div>
      ) : (
        <button
          onClick={onPurchase}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          {isLoggedIn ? 'Purchase Agent' : 'Sign In to Purchase'}
        </button>
      )}
    </div>
  )
}
