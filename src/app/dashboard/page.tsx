'use client'

import { useState, useEffect, Suspense } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { User } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import ModernBackground from '@/components/layouts/ModernBackground'
import ModernHeader from '@/components/layouts/ModernHeader'

interface PurchasedAgent {
  id: string
  agent_id: string
  user_id: string
  remaining_credits: number
  created_at: string
  agent: {
    id: string
    name: string
    description: string
    credit_cost: number
    category: string
    icon_url?: string
    webhook_url?: string
    input_schema?: any[]
  }
}

function DashboardContent() {
  const [user, setUser] = useState<User | null>(null)
  const [userCredits, setUserCredits] = useState<number>(0)
  const [purchasedAgents, setPurchasedAgents] = useState<PurchasedAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<PurchasedAgent | null>(null)
  const [executionData, setExecutionData] = useState<Record<string, string>>({})
  const [executing, setExecuting] = useState(false)
  const [executionResult, setExecutionResult] = useState<any>(null)
  const [executionError, setExecutionError] = useState<string | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    checkUserAndLoadData()
  }, [])

  useEffect(() => {
    // Show success message if payment completed
    if (searchParams.get('payment') === 'success') {
      setTimeout(() => {
        alert('Payment successful! Credits added to your account.')
      }, 500)
    }
  }, [searchParams])

  const checkUserAndLoadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      setUser(user)
      await Promise.all([
        loadPurchasedAgents(user.id),
        loadUserCredits(user.id)
      ])
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const loadPurchasedAgents = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_agents')
        .select(`
          *,
          agent:agents(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPurchasedAgents(data || [])
    } catch (error) {
      console.error('Error loading purchased agents:', error)
    }
  }

  const loadUserCredits = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single()

      if (error) throw error
      setUserCredits(data?.credits || 0)
    } catch (error) {
      console.error('Error loading user credits:', error)
    }
  }

  const handleExecuteAgent = async (purchasedAgent: PurchasedAgent) => {
    setExecuting(true)
    setExecutionError(null)
    setExecutionResult(null)

    try {
      const response = await fetch('/api/run-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: purchasedAgent.agent_id,
          inputs: executionData
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Execution failed')
      }

      setExecutionResult(result.data)

      // Refresh credits and agents
      if (user) {
        await Promise.all([
          loadUserCredits(user.id),
          loadPurchasedAgents(user.id)
        ])
      }
    } catch (error: any) {
      setExecutionError(error.message || 'Failed to execute workflow')
    } finally {
      setExecuting(false)
    }
  }

  if (loading) {
    return (
      <ModernBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading dashboard...</p>
          </div>
        </div>
      </ModernBackground>
    )
  }

  return (
    <ModernBackground>
      <ModernHeader user={user} credits={userCredits} />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">My Dashboard</h1>
            <p className="text-gray-400">Manage and execute your AI agents</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Available Credits</p>
                  <p className="text-2xl font-bold text-white">{userCredits}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Purchased Agents</p>
                  <p className="text-2xl font-bold text-white">{purchasedAgents.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Quick Actions</p>
                  <button
                    onClick={() => router.push('/browse')}
                    className="text-sm text-cyan-400 hover:text-cyan-300 font-medium"
                  >
                    Browse More Agents →
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Agents Grid */}
          {purchasedAgents.length === 0 ? (
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-12 text-center">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-2xl font-bold text-white mb-2">No Agents Yet</h3>
              <p className="text-gray-400 mb-6">Purchase your first AI agent to get started</p>
              <button
                onClick={() => router.push('/browse')}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300"
              >
                Browse Agents
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {purchasedAgents.map((purchasedAgent) => (
                <div
                  key={purchasedAgent.id}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300"
                >
                  {/* Agent Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <span className="text-2xl">🤖</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{purchasedAgent.agent.name}</h3>
                        <p className="text-sm text-gray-400">{purchasedAgent.agent.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Cost per run</p>
                      <p className="text-lg font-bold text-cyan-400">₹{purchasedAgent.agent.credit_cost}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-400 mb-4">{purchasedAgent.agent.description}</p>

                  {/* Execution Form */}
                  {selectedAgent?.id === purchasedAgent.id ? (
                    <div className="space-y-4 mt-4">
                      {purchasedAgent.agent.input_schema?.map((field: any) => (
                        <div key={field.name}>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            {field.label} {field.required && <span className="text-red-400">*</span>}
                          </label>
                          {field.type === 'textarea' ? (
                            <textarea
                              value={executionData[field.name] || ''}
                              onChange={(e) => setExecutionData({ ...executionData, [field.name]: e.target.value })}
                              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                              placeholder={field.placeholder}
                              rows={3}
                              required={field.required}
                            />
                          ) : (
                            <input
                              type={field.type}
                              value={executionData[field.name] || ''}
                              onChange={(e) => setExecutionData({ ...executionData, [field.name]: e.target.value })}
                              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                              placeholder={field.placeholder}
                              required={field.required}
                            />
                          )}
                        </div>
                      ))}

                      {executionError && (
                        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                          <p className="text-red-200 text-sm">{executionError}</p>
                        </div>
                      )}

                      {executionResult && (
                        <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
                          <p className="text-green-200 text-sm font-semibold mb-2">Execution Successful!</p>
                          <pre className="text-xs text-green-100 overflow-auto max-h-40">
                            {JSON.stringify(executionResult, null, 2)}
                          </pre>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button
                          onClick={() => handleExecuteAgent(purchasedAgent)}
                          disabled={executing || userCredits < purchasedAgent.agent.credit_cost}
                          className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {executing ? 'Executing...' : `Execute (${purchasedAgent.agent.credit_cost} credits)`}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAgent(null)
                            setExecutionData({})
                            setExecutionError(null)
                            setExecutionResult(null)
                          }}
                          className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedAgent(purchasedAgent)}
                      className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300"
                    >
                      Execute Agent
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModernBackground>
  )
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <ModernBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading dashboard...</p>
          </div>
        </div>
      </ModernBackground>
    }>
      <DashboardContent />
    </Suspense>
  )
}
