'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

interface Agent {
  id: string
  name: string
  description: string
  credit_cost: number
  category: string
  icon_url?: string
  webhook_url?: string
  input_schema?: any[]
  is_active: boolean
  created_at: string
  updated_at: string
}

interface FormField {
  id: string
  name: string
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'number' | 'email' | 'url'
  label: string
  placeholder?: string
  required: boolean
  options?: string[]
}

export default function AdminPanel() {
  const [user, setUser] = useState<User | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [requiresInputs, setRequiresInputs] = useState(false)
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [forceUpdate, setForceUpdate] = useState(0) // Force re-renders
  const router = useRouter()

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    credit_cost: 1,
    category: '',
    webhook_url: '',
    is_active: true
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    checkAdmin()
    loadAgents()
    
    // Set up real-time subscription
    const cleanup = setupRealtimeSubscription()
    
    // Cleanup on unmount
    return cleanup
  }, [])

  // Force re-render when forceUpdate changes
  useEffect(() => {
    if (forceUpdate > 0) {
      console.log('UI force updated:', forceUpdate)
    }
  }, [forceUpdate])

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('admin-agents-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agents'
        },
        (payload) => {
          console.log('Real-time agent update:', payload)
          // Force immediate reload of agents
          loadAgents()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email !== 'team@irizpro.com') {
      router.push('/dashboard')
      return
    }
    setUser(user)
  }

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAgents(data || [])
      
      // Force UI re-render
      setForceUpdate(prev => prev + 1)
      
      console.log('Agents loaded:', data?.length || 0)
    } catch (error) {
      console.error('Error loading agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const addFormField = (type: FormField['type']) => {
    const newField: FormField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: '',
      type,
      label: '',
      placeholder: '',
      required: false,
      options: (type === 'select' || type === 'radio') ? [''] : undefined
    }
    setFormFields([...formFields, newField])
  }

  const updateFormField = (id: string, field: string, value: any) => {
    setFormFields(prevFields => 
      prevFields.map(formField => 
        formField.id === id ? { ...formField, [field]: value } : formField
      )
    )
  }

  const removeFormField = (id: string) => {
    setFormFields(prevFields => prevFields.filter(field => field.id !== id))
  }

  const moveFormField = (id: string, direction: 'up' | 'down') => {
    const currentIndex = formFields.findIndex(field => field.id === id)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= formFields.length) return

    const newFields = [...formFields]
    const [movedField] = newFields.splice(currentIndex, 1)
    newFields.splice(newIndex, 0, movedField)
    setFormFields(newFields)
  }

  const addOption = (fieldId: string) => {
    setFormFields(prevFields =>
      prevFields.map(field =>
        field.id === fieldId && field.options
          ? { ...field, options: [...field.options, ''] }
          : field
      )
    )
  }

  const updateOption = (fieldId: string, optionIndex: number, value: string) => {
    setFormFields(prevFields =>
      prevFields.map(field =>
        field.id === fieldId && field.options
          ? {
              ...field,
              options: field.options.map((option, index) =>
                index === optionIndex ? value : option
              )
            }
          : field
      )
    )
  }

  const removeOption = (fieldId: string, optionIndex: number) => {
    setFormFields(prevFields =>
      prevFields.map(field =>
        field.id === fieldId && field.options && field.options.length > 1
          ? {
              ...field,
              options: field.options.filter((_, index) => index !== optionIndex)
            }
          : field
      )
    )
  }

  const generateInputSchema = () => {
    return formFields
      .filter(field => field.name.trim() && field.label.trim())
      .map(field => ({
        name: field.name,
        type: field.type,
        label: field.label,
        required: field.required,
        placeholder: field.placeholder || undefined,
        options: field.options?.filter(opt => opt.trim()) || undefined
      }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Use edit submit if editing an agent
    if (editingAgent) {
      return handleEditSubmit(e)
    }
    
    setSubmitting(true)

    try {
      // Validate form fields if inputs are required
      if (requiresInputs) {
        const validFields = formFields.filter(field => field.name.trim() && field.label.trim())
        if (validFields.length === 0) {
          alert('Please add at least one input field or uncheck "requires user inputs"')
          setSubmitting(false)
          return
        }
      }

      const inputSchema = requiresInputs ? generateInputSchema() : null

      const { error } = await supabase
        .from('agents')
        .insert([{
          ...formData,
          input_schema: inputSchema
        }])

      if (error) throw error

      // Force immediate reload of agents list
      await loadAgents()

      // Reset form
      setFormData({
        name: '',
        description: '',
        credit_cost: 1,
        category: '',
        webhook_url: '',
        is_active: true
      })
      setRequiresInputs(false)
      setFormFields([])
      setShowForm(false)
      
      showNotification('Agent deployed successfully!', 'success')
    } catch (error) {
      console.error('Error adding agent:', error)
      showNotification('Error deploying agent. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleAgentStatus = async (agentId: string, currentStatus: boolean) => {
    setActionLoading(agentId)
    
    try {
      const { error } = await supabase
        .from('agents')
        .update({ 
          is_active: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)

      if (error) throw error

      // Force immediate reload of agents list
      await loadAgents()
      
      showNotification(
        `Agent ${!currentStatus ? 'activated' : 'deactivated'} successfully!`, 
        'success'
      )
    } catch (error) {
      console.error('Error updating agent status:', error)
      showNotification('Error updating agent status.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const editAgent = (agent: Agent) => {
    setEditingAgent(agent)
    setFormData({
      name: agent.name,
      description: agent.description,
      credit_cost: agent.credit_cost,
      category: agent.category,
      webhook_url: agent.webhook_url || '',
      is_active: agent.is_active
    })
    
    // Load existing input schema
    if (agent.input_schema && agent.input_schema.length > 0) {
      setRequiresInputs(true)
      setFormFields(agent.input_schema.map((field: any, index: number) => ({
        id: `existing_${index}_${Date.now()}`,
        name: field.name,
        type: field.type,
        label: field.label,
        placeholder: field.placeholder || '',
        required: field.required || false,
        options: field.options || (field.type === 'select' || field.type === 'radio' ? [''] : undefined)
      })))
    } else {
      setRequiresInputs(false)
      setFormFields([])
    }
    
    setShowEditForm(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAgent) return
    
    setSubmitting(true)

    try {
      // Validate form fields if inputs are required
      if (requiresInputs) {
        const validFields = formFields.filter(field => field.name.trim() && field.label.trim())
        if (validFields.length === 0) {
          alert('Please add at least one input field or uncheck "requires user inputs"')
          setSubmitting(false)
          return
        }
      }

      const inputSchema = requiresInputs ? generateInputSchema() : null

      const { error } = await supabase
        .from('agents')
        .update({
          name: formData.name,
          description: formData.description,
          credit_cost: formData.credit_cost,
          category: formData.category,
          webhook_url: formData.webhook_url,
          is_active: formData.is_active,
          input_schema: inputSchema,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingAgent.id)

      if (error) throw error

      // Force immediate reload of agents list
      await loadAgents()

      // Reset form
      setEditingAgent(null)
      setFormData({
        name: '',
        description: '',
        credit_cost: 1,
        category: '',
        webhook_url: '',
        is_active: true
      })
      setRequiresInputs(false)
      setFormFields([])
      setShowEditForm(false)
      
      showNotification('Agent updated successfully!', 'success')
    } catch (error) {
      console.error('Error updating agent:', error)
      showNotification('Error updating agent. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const cancelEdit = () => {
    setEditingAgent(null)
    setShowEditForm(false)
    setFormData({
      name: '',
      description: '',
      credit_cost: 1,
      category: '',
      webhook_url: '',
      is_active: true
    })
    setRequiresInputs(false)
    setFormFields([])
  }

  const deleteAgent = async (agentId: string, agentName: string) => {
    if (!confirm(`⚠️ DANGER ZONE ⚠️\n\nAre you sure you want to PERMANENTLY DELETE "${agentName}"?\n\nThis action will:\n- Remove the agent from the marketplace\n- Delete all user purchases of this agent\n- Remove all execution history\n\nThis CANNOT be undone!`)) {
      return
    }

    setActionLoading(agentId)

    try {
      console.log('🗑️ Admin deletion started for:', agentName)
      console.log('Agent ID:', agentId)
      
      // Use the diagnostic database function
      const { data, error } = await supabase.rpc('delete_agent_safe', { 
        target_agent_id: agentId 
      })
      
      if (error) {
        console.error('❌ Database function error:', error)
        throw new Error(`Database function failed: ${error.message}`)
      }

      console.log('📊 Database function response:', data)

      // Check if deletion was successful
      if (data && data.success) {
        console.log('✅ Agent deletion completed successfully')
        console.log(`🧹 Deleted ${data.deleted_executions} executions and ${data.deleted_user_agents} user purchases`)
        
        // Immediate UI update
        await loadAgents()
        
        showNotification(`✅ Agent "${agentName}" permanently deleted!`, 'success')
        
      } else if (data && !data.success) {
        // Function returned detailed error info
        console.error('❌ Deletion failed with details:', data)
        
        let errorMessage = 'Deletion failed'
        let helpMessage = ''
        
        if (data.error_type === 'foreign_key_violation') {
          errorMessage = 'Cannot delete: Agent still has database references'
          helpMessage = 'There may be additional tables referencing this agent that need to be cleaned up first.'
        } else {
          errorMessage = data.error_message || 'Unknown database error'
          helpMessage = data.hint || 'Check database logs for more details.'
        }
        
        showNotification(`❌ ${errorMessage}`, 'error')
        
        console.log('💡 Admin Help:', helpMessage)
        console.log('🔍 Error Details:', {
          type: data.error_type,
          message: data.error_message,
          sqlstate: data.sqlstate
        })
        
      } else {
        throw new Error('Unexpected response from deletion function')
      }
      
    } catch (error) {
      console.error('❌ Admin deletion failed:', error)
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      showNotification(`❌ Failed to delete "${agentName}": ${errorMessage}`, 'error')
      
      console.log('💡 Admin Troubleshooting:')
      console.log('1. Check if delete_agent_safe function exists in database')
      console.log('2. Verify your admin permissions')
      console.log('3. Check browser network tab for detailed errors')
      
    } finally {
      setActionLoading(null)
    }
  }

  const showNotification = (message: string, type: 'success' | 'error') => {
    const notification = document.createElement('div')
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg border-2 font-mono text-sm ${
      type === 'success' 
        ? 'bg-green-900 border-green-400 text-green-300' 
        : 'bg-red-900 border-red-400 text-red-300'
    }`
    notification.textContent = message
    document.body.appendChild(notification)
    
    setTimeout(() => {
      document.body.removeChild(notification)
    }, 3000)
  }

  const fillSampleData = () => {
    setFormData({
      name: 'SEO Content Generator',
      description: 'AI-powered SEO blog content generator that creates optimized articles',
      credit_cost: 5,
      category: 'AI Content',
      webhook_url: 'https://n8n.irizpro.com/webhook/5b1c4b52-59d1-42a3-b8ad-c7a50350bdc2',
      is_active: true
    })
    setRequiresInputs(true)
    setFormFields([
      {
        id: 'sample_1',
        name: 'topic',
        type: 'text',
        label: 'Content Topic',
        placeholder: 'e.g., Best Project Management Tools',
        required: true
      },
      {
        id: 'sample_2', 
        name: 'target_keywords',
        type: 'textarea',
        label: 'Target Keywords',
        placeholder: 'seo, content, blog writing',
        required: true
      },
      {
        id: 'sample_3',
        name: 'word_count',
        type: 'select',
        label: 'Word Count',
        required: true,
        options: ['1000', '1500', '2000']
      }
    ])
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-4">◉ ADMIN ACCESS ◉</div>
          <div className="text-sm">Verifying credentials...</div>
        </div>
      </div>
    )
  }

  const categories = [...new Set(agents.map(agent => agent.category).filter(Boolean))]

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono">
      {/* Header */}
      <header className="border-b-2 border-red-500 p-4 bg-gray-900/20">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-red-400">◉ AGENT ADMIN PANEL ◉</h1>
            <div className="text-sm bg-red-900/30 border border-red-500 rounded px-2 py-1">
              <span className="text-red-300">FORM BUILDER v2.0</span>
            </div>
            <div className="text-sm bg-green-900/30 border border-green-500 rounded px-2 py-1">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-300">LIVE UPDATES</span>
              </div>
            </div>
          </div>
          
          <nav className="flex items-center space-x-6">
            {!showEditForm && (
              <button 
                onClick={() => setShowForm(!showForm)}
                className="px-4 py-2 border border-green-500 text-green-400 hover:bg-green-900 transition-colors"
              >
                {showForm ? '✕ CANCEL' : '+ DEPLOY AGENT'}
              </button>
            )}
            
            <button 
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 border border-cyan-500 text-cyan-400 hover:bg-cyan-900 transition-colors"
            >
              DASHBOARD
            </button>

            <button 
              onClick={() => router.push('/browse')}
              className="px-4 py-2 border border-purple-500 text-purple-400 hover:bg-purple-900 transition-colors"
            >
              VIEW MARKETPLACE
            </button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto p-6">
        {/* Add Agent Form */}
        {(showForm || showEditForm) && (
          <div className="mb-8 bg-gray-900 border-2 border-green-500 rounded-lg p-6 shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl text-green-400">
                {editingAgent ? '◉ EDIT AGENT ◉' : '◉ DEPLOY NEW AGENT ◉'}
              </h2>
              <div className="flex space-x-2">
                {!editingAgent && (
                  <button 
                    onClick={fillSampleData}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    FILL SAMPLE DATA
                  </button>
                )}
                {editingAgent && (
                  <button 
                    onClick={cancelEdit}
                    className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    CANCEL EDIT
                  </button>
                )}
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Agent Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-green-300">Agent Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-green-400 focus:outline-none text-green-200"
                    placeholder="e.g., SEO Content Analyzer"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-green-300">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-green-400 focus:outline-none text-green-200"
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="AI Content">AI Content</option>
                    <option value="Data Processing">Data Processing</option>
                    <option value="Automation">Automation</option>
                    <option value="Research">Research</option>
                    <option value="SEO & Marketing">SEO & Marketing</option>
                    <option value="E-commerce">E-commerce</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-green-300">Credit Cost</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={formData.credit_cost}
                    onChange={(e) => setFormData({...formData, credit_cost: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-green-400 focus:outline-none text-green-200"
                    required
                  />
                </div>

                <div className="flex items-center">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                      className="w-4 h-4 text-green-500"
                    />
                    <span className="text-sm text-green-300">Active in Marketplace</span>
                  </label>
                </div>
              </div>

              {/* Webhook URL */}
              <div>
                <label className="block text-sm font-medium mb-2 text-green-300">n8n Webhook URL</label>
                <input
                  type="url"
                  value={formData.webhook_url}
                  onChange={(e) => setFormData({...formData, webhook_url: e.target.value})}
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-green-400 focus:outline-none text-green-200"
                  placeholder="https://n8n.irizpro.com/webhook/your-webhook-id"
                />
              </div>

              {/* User Inputs Checkbox */}
              <div className="bg-gray-800/50 border border-yellow-500 rounded-lg p-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiresInputs}
                    onChange={(e) => setRequiresInputs(e.target.checked)}
                    className="w-5 h-5 text-yellow-500"
                  />
                  <div>
                    <span className="text-lg font-medium text-yellow-400">
                      🛠 This agent requires user inputs
                    </span>
                    <p className="text-sm text-gray-400 mt-1">
                      Check this if users need to provide data before executing this agent
                    </p>
                  </div>
                </label>
              </div>

              {/* Visual Form Builder */}
              {requiresInputs && (
                <GoogleFormsStyleBuilder
                  formFields={formFields}
                  onAddField={addFormField}
                  onUpdateField={updateFormField}
                  onRemoveField={removeFormField}
                  onMoveField={moveFormField}
                  onAddOption={addOption}
                  onUpdateOption={updateOption}
                  onRemoveOption={removeOption}
                />
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2 text-green-300">Agent Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-green-400 focus:outline-none h-24 text-green-200"
                  placeholder="Describe what this agent does, its benefits, and capabilities..."
                  required
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-black font-bold border border-green-400 transition-colors"
              >
                {submitting ? (editingAgent ? '💾 UPDATING AGENT...' : '🚀 DEPLOYING AGENT...') : (editingAgent ? '💾 UPDATE AGENT' : '🚀 DEPLOY TO MARKETPLACE')}
              </button>
            </form>
          </div>
        )}

        {/* Agents List */}
        <div className="bg-gray-900 border-2 border-red-500 rounded-lg p-6 shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl text-red-400">◉ AGENT REGISTRY ◉</h2>
            <div className="text-sm">
              Total: <span className="text-cyan-400 font-bold">{agents.length}</span> | 
              Active: <span className="text-green-400 font-bold">{agents.filter(a => a.is_active).length}</span> |
              With Inputs: <span className="text-yellow-400 font-bold">{agents.filter(a => a.input_schema && a.input_schema.length > 0).length}</span>
            </div>
          </div>

          {agents.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-4">🤖</div>
              <div className="text-lg">No agents in the system</div>
              <div className="text-sm mt-2">Deploy your first agent to get started</div>
            </div>
          ) : (
            <div className="space-y-4">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={`border-2 rounded-lg p-6 transition-all duration-300 ${
                    agent.is_active 
                      ? 'border-green-500 bg-green-900/10 shadow-green-500/20' 
                      : 'border-gray-600 bg-gray-800/10 shadow-gray-500/20'
                  } shadow-lg hover:shadow-xl`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-bold text-cyan-400">{agent.name}</h3>
                        <span className="text-sm text-purple-400 bg-purple-900/30 border border-purple-500 rounded px-2 py-1">
                          {agent.category}
                        </span>
                        {agent.webhook_url && (
                          <span className="text-sm text-blue-400 bg-blue-900/30 border border-blue-500 rounded px-2 py-1">
                            n8n Ready
                          </span>
                        )}
                        {agent.input_schema && agent.input_schema.length > 0 && (
                          <span className="text-sm text-yellow-400 bg-yellow-900/30 border border-yellow-500 rounded px-2 py-1">
                            {agent.input_schema.length} Inputs
                          </span>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-400 space-y-1 mb-2">
                        <div>Created: {new Date(agent.created_at).toLocaleString()}</div>
                        <div>Cost: ₹{agent.credit_cost} | Status: {agent.is_active ? 'Active' : 'Inactive'}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className={`px-3 py-2 text-xs font-bold rounded border-2 ${
                        agent.is_active 
                          ? 'bg-green-600 text-black border-green-400' 
                          : 'bg-gray-600 text-white border-gray-400'
                      }`}>
                        {agent.is_active ? '✓ ACTIVE' : '✕ INACTIVE'}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-300 mb-4 leading-relaxed">{agent.description}</p>

                  {/* Show Input Fields Preview */}
                  {agent.input_schema && agent.input_schema.length > 0 && (
                    <div className="mb-4 p-3 bg-black/40 border border-yellow-600 rounded">
                      <div className="text-yellow-300 text-sm font-bold mb-2">Required User Inputs:</div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {agent.input_schema.map((field: any, index: number) => (
                          <div key={index} className="text-xs">
                            <span className="text-yellow-400">{field.label}</span>
                            <span className="text-gray-400"> ({field.type})</span>
                            {field.required && <span className="text-red-400">*</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-3">
                    <button
                      onClick={() => editAgent(agent)}
                      disabled={actionLoading === agent.id}
                      className="px-4 py-3 border-2 border-blue-500 text-blue-400 hover:bg-blue-900 hover:text-white transition-all font-bold"
                    >
                      ✏️ EDIT
                    </button>
                    
                    <button
                      onClick={() => toggleAgentStatus(agent.id, agent.is_active)}
                      disabled={actionLoading === agent.id}
                      className={`flex-1 px-4 py-3 border-2 transition-all font-bold ${
                        agent.is_active
                          ? 'border-red-500 text-red-400 hover:bg-red-900 hover:text-white'
                          : 'border-green-500 text-green-400 hover:bg-green-900 hover:text-black'
                      } ${actionLoading === agent.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {actionLoading === agent.id ? (
                        <span className="flex items-center justify-center">
                          <div className="animate-spin mr-2">⟳</div>
                          UPDATING...
                        </span>
                      ) : (
                        agent.is_active ? '⏸ DEACTIVATE' : '▶ ACTIVATE'
                      )}
                    </button>

                    <button
                      onClick={() => deleteAgent(agent.id, agent.name)}
                      disabled={actionLoading === agent.id}
                      className={`px-6 py-3 border-2 border-red-600 text-red-400 hover:bg-red-900 hover:text-white transition-all font-bold ${
                        actionLoading === agent.id ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      🗑 DELETE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// Google Forms Style Form Builder Component
interface GoogleFormsStyleBuilderProps {
  formFields: FormField[]
  onAddField: (type: FormField['type']) => void
  onUpdateField: (id: string, field: string, value: any) => void
  onRemoveField: (id: string) => void
  onMoveField: (id: string, direction: 'up' | 'down') => void
  onAddOption: (fieldId: string) => void
  onUpdateOption: (fieldId: string, optionIndex: number, value: string) => void
  onRemoveOption: (fieldId: string, optionIndex: number) => void
}

function GoogleFormsStyleBuilder({ 
  formFields, 
  onAddField, 
  onUpdateField, 
  onRemoveField, 
  onMoveField,
  onAddOption,
  onUpdateOption,
  onRemoveOption
}: GoogleFormsStyleBuilderProps) {

  const fieldTypes: { type: FormField['type']; label: string; icon: string }[] = [
    { type: 'text', label: 'Short Text', icon: '📝' },
    { type: 'textarea', label: 'Long Text', icon: '📄' },
    { type: 'select', label: 'Dropdown', icon: '📋' },
    { type: 'radio', label: 'Multiple Choice', icon: '🔘' },
    { type: 'checkbox', label: 'Checkboxes', icon: '☑️' },
    { type: 'number', label: 'Number', icon: '🔢' },
    { type: 'email', label: 'Email', icon: '📧' },
    { type: 'url', label: 'URL', icon: '🔗' }
  ]

  // Prevent form submission on button clicks
  const handleAddOption = (e: React.MouseEvent, fieldId: string) => {
    e.preventDefault()
    e.stopPropagation()
    onAddOption(fieldId)
  }

  const handleRemoveOption = (e: React.MouseEvent, fieldId: string, optionIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    onRemoveOption(fieldId, optionIndex)
  }

  const handleMoveField = (e: React.MouseEvent, id: string, direction: 'up' | 'down') => {
    e.preventDefault()
    e.stopPropagation()
    onMoveField(id, direction)
  }

  const handleRemoveField = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    onRemoveField(id)
  }

  const handleAddField = (e: React.MouseEvent, type: FormField['type']) => {
    e.preventDefault()
    e.stopPropagation()
    onAddField(type)
  }

  return (
    <div className="bg-gray-800/50 border border-yellow-500 rounded-lg p-6">
      <h3 className="text-lg font-bold text-yellow-400 mb-6">🛠 Form Builder</h3>
      
      {/* Form Fields */}
      <div className="space-y-4 mb-6">
        {formFields.map((field, index) => (
          <div key={field.id} className="bg-white border-2 border-gray-300 rounded-lg p-4 relative">
            {/* Field Header */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-lg">
                  {fieldTypes.find(ft => ft.type === field.type)?.icon}
                </span>
                <span className="text-gray-600 font-medium">
                  {fieldTypes.find(ft => ft.type === field.type)?.label}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={(e) => handleMoveField(e, field.id, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={(e) => handleMoveField(e, field.id, 'down')}
                  disabled={index === formFields.length - 1}
                  className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={(e) => handleRemoveField(e, field.id)}
                  className="p-1 text-red-600 hover:bg-red-100 rounded"
                  title="Delete field"
                >
                  🗑
                </button>
              </div>
            </div>

            {/* Field Configuration */}
            <div className="space-y-3">
              {/* Display Label */}
              <div>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => onUpdateField(field.id, 'label', e.target.value)}
                  placeholder="Question"
                  className="w-full text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none pb-1 text-lg"
                />
              </div>

              {/* Field Key */}
              <div className="bg-gray-50 p-3 rounded">
                <label className="block text-sm font-medium text-gray-600 mb-1">Field Key (for n8n)</label>
                <input
                  type="text"
                  value={field.name}
                  onChange={(e) => onUpdateField(field.id, 'name', e.target.value)}
                  placeholder="field_name"
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none text-gray-800"
                />
              </div>

              {/* Placeholder */}
              <div className="bg-gray-50 p-3 rounded">
                <label className="block text-sm font-medium text-gray-600 mb-1">Placeholder Text</label>
                <input
                  type="text"
                  value={field.placeholder}
                  onChange={(e) => onUpdateField(field.id, 'placeholder', e.target.value)}
                  placeholder="Your answer"
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none text-gray-800"
                />
              </div>

              {/* Options for select/radio */}
              {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                <div className="bg-gray-50 p-3 rounded">
                  <label className="block text-sm font-medium text-gray-600 mb-2">Options</label>
                  <div className="space-y-2">
                    {field.options?.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center space-x-2">
                        <span className="text-gray-400 text-sm w-4">{optionIndex + 1}.</span>
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => onUpdateOption(field.id, optionIndex, e.target.value)}
                          placeholder={`Option ${optionIndex + 1}`}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none text-gray-800"
                        />
                        {field.options && field.options.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => handleRemoveOption(e, field.id, optionIndex)}
                            className="text-red-600 hover:bg-red-100 p-1 rounded text-sm"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={(e) => handleAddOption(e, field.id)}
                      className="text-blue-600 hover:bg-blue-100 px-2 py-1 rounded text-sm"
                    >
                      + Add option
                    </button>
                  </div>
                </div>
              )}

              {/* Field Preview */}
              <div className="bg-gray-50 p-3 rounded">
                <label className="block text-sm font-medium text-gray-600 mb-2">Preview</label>
                <div className="text-gray-800">
                  {field.type === 'textarea' ? (
                    <textarea 
                      placeholder={field.placeholder || 'Your answer'}
                      disabled 
                      className="w-full p-2 border border-gray-300 rounded resize-none h-20 bg-white"
                    />
                  ) : field.type === 'select' ? (
                    <select disabled className="w-full p-2 border border-gray-300 rounded bg-white">
                      <option>{field.placeholder || 'Choose'}</option>
                      {field.options?.filter(opt => opt.trim()).map((option, i) => (
                        <option key={i}>{option}</option>
                      ))}
                    </select>
                  ) : field.type === 'radio' ? (
                    <div className="space-y-2">
                      {field.options?.filter(opt => opt.trim()).map((option, i) => (
                        <div key={i} className="flex items-center space-x-2">
                          <input type="radio" disabled className="text-blue-600" />
                          <span>{option}</span>
                        </div>
                      ))}
                    </div>
                  ) : field.type === 'checkbox' ? (
                    <div className="space-y-2">
                      {field.options?.filter(opt => opt.trim()).map((option, i) => (
                        <div key={i} className="flex items-center space-x-2">
                          <input type="checkbox" disabled className="text-blue-600" />
                          <span>{option}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <input 
                      type={field.type}
                      placeholder={field.placeholder || 'Your answer'}
                      disabled 
                      className="w-full p-2 border border-gray-300 rounded bg-white"
                    />
                  )}
                </div>
              </div>

              {/* Required Toggle */}
              <div className="flex items-center space-x-2 pt-2 border-t border-gray-200">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => onUpdateField(field.id, 'required', e.target.checked)}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-600">Required</span>
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Field Button */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
        <div className="text-center">
          <div className="text-gray-500 mb-3">Add a new field</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {fieldTypes.map(({ type, label, icon }) => (
              <button
                key={type}
                type="button"
                onClick={(e) => handleAddField(e, type)}
                className="p-3 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors flex items-center justify-center space-x-2"
              >
                <span>{icon}</span>
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}