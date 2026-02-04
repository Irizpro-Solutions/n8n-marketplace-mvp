'use client'

import { useState, useEffect, Suspense } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { User } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import ModernBackground from '@/components/layouts/ModernBackground'
import ModernHeader from '@/components/layouts/ModernHeader'
import AgentExecutionModal from '@/components/dashboard/AgentExecutionModal'
import CredentialManagementSidebar from '@/components/credentials/CredentialManagementSidebar'

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
    required_platforms?: string[]
  }
}

interface CredentialStatus {
  has_all_credentials: boolean
  missing_platforms: string[]
  required_platforms: string[]
}

function DashboardContent() {
  const [user, setUser] = useState<User | null>(null)
  const [userCredits, setUserCredits] = useState<number>(0)
  const [purchasedAgents, setPurchasedAgents] = useState<PurchasedAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAgent, setModalAgent] = useState<PurchasedAgent | null>(null)
  const [showCredentialSidebar, setShowCredentialSidebar] = useState(false)
  const [credentialStatus, setCredentialStatus] = useState<CredentialStatus | null>(null)
  const [checkingCredentials, setCheckingCredentials] = useState(false)
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
        loadPurchasedAgents(user.id, user.email),
        loadUserCredits(user.id)
      ])
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  const loadPurchasedAgents = async (userId: string, userEmail?: string | null) => {
    try {
      const isAdmin = userEmail === 'team@irizpro.com'

      if (isAdmin) {
        // Admin: Load ALL active agents via API route
        const response = await fetch('/api/agents/list')
        if (!response.ok) throw new Error('Failed to load agents')

        const result = await response.json()
        if (!result.success || !result.data) {
          throw new Error(result.error || 'Failed to load agents')
        }

        // Transform to match PurchasedAgent structure
        const transformedData = result.data.map((agent: any) => ({
          id: agent.id,
          agent_id: agent.id,
          user_id: userId,
          remaining_credits: 999999, // Unlimited for admin
          created_at: agent.created_at,
          agent: agent
        })) || []

        setPurchasedAgents(transformedData)
      } else {
        // Regular user: Load only purchased agents
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
      }
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

  const checkCredentialStatus = async (agentId: string): Promise<CredentialStatus | null> => {
    try {
      setCheckingCredentials(true)
      const response = await fetch(`/api/credentials/status?agentId=${agentId}`)

      if (!response.ok) {
        throw new Error('Failed to check credential status')
      }

      const data = await response.json()
      return {
        has_all_credentials: data.has_all_credentials,
        missing_platforms: data.missing_platforms,
        required_platforms: data.required_platforms,
      }
    } catch (error) {
      console.error('Error checking credentials:', error)
      return null
    } finally {
      setCheckingCredentials(false)
    }
  }

  const handleAgentClick = async (purchasedAgent: PurchasedAgent) => {
    setModalAgent(purchasedAgent)
    setExecutionError(null)
    setExecutionResult(null)
    setCredentialStatus(null)

    // Check if agent requires credentials
    const requiredPlatforms = purchasedAgent.agent.required_platforms || []

    if (requiredPlatforms.length === 0) {
      // No credentials required, show execution modal directly
      return
    }

    // Dynamic credential detection: Check if user has all required credentials
    // Don't await - let modal open immediately, check credentials in background
    checkCredentialStatus(purchasedAgent.agent_id).then(status => {
      if (status) {
        setCredentialStatus(status)

        if (!status.has_all_credentials && status.missing_platforms.length > 0) {
          // Missing credentials - show warning
          setExecutionError(
            `⚠️ Missing ${status.missing_platforms.length} credential(s): ${status.missing_platforms.join(', ')}. Please connect these credentials before running this agent.`
          )
        } else {
          // All credentials connected - allow execution
          console.log('✅ All credentials connected for', purchasedAgent.agent.name)
        }
      }
    }).catch(err => {
      console.error('Credential check failed:', err)
      // Don't block modal - just log the error
    })
  }

  const handleExecuteAgent = async (inputs: Record<string, string>) => {
    if (!modalAgent) return

    setExecuting(true)
    setExecutionError(null)
    setExecutionResult(null)

    try {
      const response = await fetch('/api/run-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: modalAgent.agent_id,
          inputs
        })
      })

      // Handle non-JSON responses (500 errors return HTML)
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Non-JSON response:', text.substring(0, 500))
        throw new Error('Server error: Received non-JSON response. Check console for details.')
      }

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Execution failed')
      }

      setExecutionResult(result.data)

      // Refresh credits and agents
      if (user) {
        await Promise.all([
          loadUserCredits(user.id),
          loadPurchasedAgents(user.id, user.email)
        ])
      }
    } catch (error: any) {
      console.error('Execution error:', error)
      setExecutionError(error.message || 'Failed to execute workflow')
    } finally {
      setExecuting(false)
    }
  }

  const handleManageCredentials = () => {
    // Close modal when opening credential sidebar so it's not blocked
    setModalAgent(null)
    setShowCredentialSidebar(true)
  }

  const handleCloseModal = () => {
    setModalAgent(null)
    setExecutionError(null)
    setExecutionResult(null)
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
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold text-white">My Dashboard</h1>
              {user?.email === 'team@irizpro.com' && (
                <span className="px-3 py-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm font-bold rounded-full">
                  👑 ADMIN
                </span>
              )}
            </div>
            <p className="text-gray-400">
              {user?.email === 'team@irizpro.com'
                ? 'All agents available • Unlimited executions • No credit cost'
                : 'Manage and execute your AI agents'}
            </p>
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
                  <p className="text-2xl font-bold text-white">
                    {user?.email === 'team@irizpro.com' ? '∞' : userCredits}
                  </p>
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
                  <p className="text-sm text-gray-400">
                    {user?.email === 'team@irizpro.com' ? 'Available Agents' : 'Purchased Agents'}
                  </p>
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

                  {/* Action Buttons */}
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={() => handleAgentClick(purchasedAgent)}
                      className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300"
                    >
                      🚀 Execute Agent
                    </button>

                    {/* Show Manage Credentials button if agent requires credentials */}
                    {(purchasedAgent.agent.required_platforms?.length ?? 0) > 0 && (
                      <button
                        onClick={() => {
                          setModalAgent(purchasedAgent)
                          setShowCredentialSidebar(true)
                        }}
                        className="w-full py-2 bg-white/5 border border-white/10 text-gray-300 rounded-lg hover:bg-white/10 transition-colors text-sm"
                      >
                        🔐 Manage Credentials ({purchasedAgent.agent.required_platforms?.length ?? 0} platforms)
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Agent Execution Modal */}
      {modalAgent && (
        <AgentExecutionModal
          isOpen={modalAgent !== null}
          onClose={handleCloseModal}
          agent={modalAgent.agent}
          onExecute={handleExecuteAgent}
          executing={executing}
          executionResult={executionResult}
          executionError={executionError}
          hasCredentials={credentialStatus?.has_all_credentials ?? true}
          onManageCredentials={handleManageCredentials}
          showCredentialSidebar={showCredentialSidebar}
          onCloseCredentialSidebar={() => setShowCredentialSidebar(false)}
          credentialStatus={credentialStatus}
        />
      )}

      {/* Credential Management Sidebar */}
      {modalAgent && modalAgent.agent.required_platforms && (
        <CredentialManagementSidebar
          agentId={modalAgent.agent_id}
          agentName={modalAgent.agent.name}
          requiredPlatforms={modalAgent.agent.required_platforms}
          isOpen={showCredentialSidebar}
          onClose={() => {
            setShowCredentialSidebar(false)
          }}
          onCredentialsUpdated={async () => {
            // Refresh credential status after update
            if (modalAgent) {
              const status = await checkCredentialStatus(modalAgent.agent_id)
              setCredentialStatus(status)
            }
          }}
        />
      )}
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
