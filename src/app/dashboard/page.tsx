'use client'

import { useState, useEffect, Suspense } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { User } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Bot, Play, KeyRound, PackageSearch, Coins } from 'lucide-react'
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
  const [credentialAgent, setCredentialAgent] = useState<PurchasedAgent | null>(null)
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
    // Reset states
    setExecutionError(null)
    setExecutionResult(null)
    setCredentialStatus(null)

    // Check if agent requires credentials
    const requiredPlatforms = purchasedAgent.agent.required_platforms || []

    if (requiredPlatforms.length === 0) {
      // No credentials required, open modal directly
      setModalAgent(purchasedAgent)
      return
    }

    // Agent requires credentials - check if user has configured them
    toast.loading('Checking credentials...', { id: 'credential-check' })

    try {
      const status = await checkCredentialStatus(purchasedAgent.agent_id)

      if (!status) {
        toast.error('Failed to check credentials', { id: 'credential-check' })
        return
      }

      setCredentialStatus(status)

      if (!status.has_all_credentials && status.missing_platforms.length > 0) {
        // Missing credentials - show toast and prevent modal from opening
        toast.error(
          `Missing ${status.missing_platforms.length} credential(s): ${status.missing_platforms.join(', ')}. Please configure credentials first.`,
          {
            id: 'credential-check',
            duration: 5000,
            action: {
              label: 'Manage Credentials',
              onClick: () => handleManageCredentialsClick(purchasedAgent)
            }
          }
        )
        return
      }

      // All credentials configured - open modal and allow execution
      toast.success('All credentials configured ✓', { id: 'credential-check' })
      setModalAgent(purchasedAgent)

    } catch (err) {
      console.error('Credential check failed:', err)
      toast.error('Failed to verify credentials', { id: 'credential-check' })
    }
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

  const handleManageCredentialsClick = (purchasedAgent: PurchasedAgent) => {
    // Only open credential sidebar, do NOT open modal
    // This ensures mutually exclusive UI rendering
    setCredentialAgent(purchasedAgent)
    setModalAgent(null) // Ensure modal is closed
  }

  const handleManageCredentialsFromModal = () => {
    // Called from inside the modal - close modal and open sidebar
    if (!modalAgent) return

    setCredentialAgent(modalAgent)
    setModalAgent(null)
  }

  const handleCloseModal = () => {
    setModalAgent(null)
    setExecutionError(null)
    setExecutionResult(null)
  }

  const handleCloseCredentialSidebar = () => {
    setCredentialAgent(null)
  }

  if (loading) {
    return (
      <ModernBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
                  ADMIN
                </span>
              )}
            </div>
            <p className="text-gray-400">
              {user?.email === 'team@irizpro.com'
                ? 'All agents available • Unlimited executions • No credit cost'
                : 'Manage and execute your AI agents'}
            </p>
            <div className="mt-4 h-px bg-white/[0.06]"></div>
          </div>

          {/* Agents Grid */}
          {purchasedAgents.length === 0 ? (
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-12 text-center">
              <PackageSearch className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">No Agents Yet</h3>
              <p className="text-gray-400 mb-6">Purchase your first AI agent to get started</p>
              <button
                onClick={() => router.push('/browse')}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                Browse Agents
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {purchasedAgents.map((purchasedAgent) => (
                <div
                  key={purchasedAgent.id}
                  className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-6 hover:bg-white/10 hover:border-white/[0.15] hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300"
                >
                  {/* Agent Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center">
                        <Bot className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{purchasedAgent.agent.name}</h3>
                        <span className="inline-block mt-1 px-2.5 py-0.5 bg-blue-500/10 text-blue-300 text-xs font-medium rounded-full">
                          {purchasedAgent.agent.category}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
                      <Coins className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-sm font-bold text-blue-400">{purchasedAgent.agent.credit_cost}</span>
                      <span className="text-xs text-gray-500">/run</span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">{purchasedAgent.agent.description}</p>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={() => handleAgentClick(purchasedAgent)}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Execute Agent
                    </button>

                    {/* Show Manage Credentials button if agent requires credentials */}
                    {(purchasedAgent.agent.required_platforms?.length ?? 0) > 0 && (
                      <button
                        onClick={() => handleManageCredentialsClick(purchasedAgent)}
                        className="w-full py-2 bg-white/5 border border-white/10 text-gray-300 rounded-lg hover:bg-white/10 transition-all duration-300 text-sm hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Manage Credentials ({purchasedAgent.agent.required_platforms?.length ?? 0} platforms)
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
          onManageCredentials={handleManageCredentialsFromModal}
        />
      )}

      {/* Credential Management Sidebar - Independent of Modal */}
      {credentialAgent && credentialAgent.agent.required_platforms && (
        <CredentialManagementSidebar
          agentId={credentialAgent.agent_id}
          agentName={credentialAgent.agent.name}
          requiredPlatforms={credentialAgent.agent.required_platforms}
          isOpen={credentialAgent !== null}
          onClose={handleCloseCredentialSidebar}
          onCredentialsUpdated={async () => {
            // Refresh credential status after update
            const status = await checkCredentialStatus(credentialAgent.agent_id)
            setCredentialStatus(status)

            // Show success toast
            if (status?.has_all_credentials) {
              toast.success('All credentials configured successfully! You can now execute this agent.')
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
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading dashboard...</p>
          </div>
        </div>
      </ModernBackground>
    }>
      <DashboardContent />
    </Suspense>
  )
}
