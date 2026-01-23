'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import ModernBackground from '@/components/layouts/ModernBackground'
import ModernHeader from '@/components/layouts/ModernHeader'

// Import proper interfaces
interface PricingConfig {
  basePrice: number
  customPrices: { [currency: string]: number }
}

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
  pricing_config?: PricingConfig
}

interface FormField {
  id: string
  name: string
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'number' | 'email' | 'url' | 'upload'
  label: string
  placeholder?: string
  required: boolean
  options?: string[]
  acceptedFileTypes?: string[]
  maxFileSize?: number
  multiple?: boolean
}

export default function AdminPanel() {
  const [user, setUser] = useState<User | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [showForm, setShowForm] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [requiresInputs, setRequiresInputs] = useState(false)
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [forceUpdate, setForceUpdate] = useState(0)
  const router = useRouter()

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    webhook_url: '',
    is_active: true
  })

  const [agentPricing, setAgentPricing] = useState<PricingConfig>({
    basePrice: 50,
    customPrices: {}
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    checkAdmin()
    loadAgents()

    const cleanup = setupRealtimeSubscription()
    return cleanup
  }, [])

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
      id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      name: '',
      type,
      label: '',
      placeholder: '',
      required: false,
      options: (type === 'select' || type === 'radio') ? [''] : undefined,
      acceptedFileTypes: type === 'upload' ? ['image/*', 'application/pdf', '.doc,.docx,.csv,.xlsx'] : undefined,
      maxFileSize: type === 'upload' ? 10 : undefined,
      multiple: type === 'upload' ? false : undefined
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
        options: field.options?.filter(opt => opt.trim()) || undefined,
        acceptedFileTypes: field.acceptedFileTypes || undefined,
        maxFileSize: field.maxFileSize || undefined,
        multiple: field.multiple || undefined
      }))
  }

  const fillSampleData = () => {
    setFormData({
      name: 'SEO Content Analyzer',
      description: 'Analyzes your website content and provides SEO recommendations to improve search engine rankings.',
      category: 'SEO',
      webhook_url: 'https://n8n.irizpro.com/webhook/your-webhook-id',
      is_active: true
    })

    setAgentPricing({
      basePrice: 50,
      customPrices: {
        USD: 0.99,
        AED: 3.99
      }
    })

    setRequiresInputs(true)
    setFormFields([
      {
        id: 'field_1',
        name: 'website_url',
        type: 'url',
        label: 'Website URL',
        placeholder: 'https://your-website.com',
        required: true
      },
      {
        id: 'field_2',
        name: 'target_keywords',
        type: 'textarea',
        label: 'Target Keywords',
        placeholder: 'Enter your target keywords, one per line',
        required: true
      },
      {
        id: 'field_3',
        name: 'content_file',
        type: 'upload',
        label: 'Content File (Optional)',
        placeholder: '',
        required: false,
        acceptedFileTypes: ['application/pdf', '.doc,.docx'],
        maxFileSize: 5,
        multiple: false
      }
    ])
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      webhook_url: '',
      is_active: true
    })
    setAgentPricing({
      basePrice: 50,
      customPrices: {}
    })
    setRequiresInputs(false)
    setFormFields([])
    setShowForm(false)
  }

  const handlePricingChange = (newPricing: PricingConfig) => {
    setAgentPricing(newPricing)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim() || !formData.description.trim() || !formData.category.trim()) {
      alert('Please fill in all required fields')
      return
    }

    if (!formData.webhook_url.trim()) {
      alert('Webhook URL is required')
      return
    }

    try {
      setSubmitting(true)

      const inputSchema = requiresInputs ? generateInputSchema() : []

      const { data, error } = await supabase
        .from('agents')
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim(),
          category: formData.category.trim(),
          webhook_url: formData.webhook_url.trim(),
          is_active: formData.is_active,
          input_schema: inputSchema,
          credit_cost: agentPricing.basePrice,
          pricing_config: agentPricing
        })
        .select()

      if (error) throw error

      console.log('Agent created successfully:', data)
      alert('Agent deployed to marketplace successfully!')

      resetForm()
      await loadAgents()

    } catch (error) {
      console.error('Error creating agent:', error)
      alert(`Failed to deploy agent: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (agent: Agent) => {
    try {
      setEditingAgent(agent)
      setFormData({
        name: agent.name || '',
        description: agent.description || '',
        category: agent.category || '',
        webhook_url: agent.webhook_url || '',
        is_active: agent.is_active !== undefined ? agent.is_active : true
      })

      setAgentPricing(agent.pricing_config || {
        basePrice: agent.credit_cost || 50,
        customPrices: {}
      })

      const hasInputSchema = Boolean(agent.input_schema && Array.isArray(agent.input_schema) && agent.input_schema.length > 0)
      setRequiresInputs(hasInputSchema)

      const formattedFields = hasInputSchema
        ? agent.input_schema?.map((field: any, index: number) => ({
            id: field.id || `field_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${index}`,
            name: field.name || '',
            type: field.type || 'text',
            label: field.label || '',
            placeholder: field.placeholder || '',
            required: Boolean(field.required),
            options: Array.isArray(field.options) ? field.options : undefined,
            acceptedFileTypes: field.acceptedFileTypes || undefined,
            maxFileSize: field.maxFileSize || undefined,
            multiple: field.multiple || undefined
          })) || []
        : []

      setFormFields(formattedFields)
      setShowEditForm(true)

      console.log('Agent loaded for editing successfully')

    } catch (error) {
      console.error('Error loading agent for edit:', error)
      alert(`Unable to edit "${agent.name}" - it may have an old data format.\n\nOptions:\n1. Use Delete button to remove it\n2. Create a new agent instead\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleUpdateAgent = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingAgent) return

    try {
      setSubmitting(true)

      const inputSchema = requiresInputs ? generateInputSchema() : []

      const { error } = await supabase
        .from('agents')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim(),
          category: formData.category.trim(),
          webhook_url: formData.webhook_url.trim(),
          is_active: formData.is_active,
          input_schema: inputSchema,
          credit_cost: agentPricing.basePrice,
          pricing_config: agentPricing
        })
        .eq('id', editingAgent.id)

      if (error) throw error

      alert('Agent updated successfully!')
      setShowEditForm(false)
      setEditingAgent(null)
      await loadAgents()

    } catch (error) {
      console.error('Error updating agent:', error)
      alert(`Failed to update agent: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (agentId: string, currentStatus: boolean) => {
    try {
      setActionLoading(agentId)

      const { error } = await supabase
        .from('agents')
        .update({ is_active: !currentStatus })
        .eq('id', agentId)

      if (error) throw error

      await loadAgents()

    } catch (error) {
      console.error('Error toggling agent status:', error)
      alert(`Failed to ${!currentStatus ? 'activate' : 'deactivate'} agent`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteAgent = async (agentId: string, agentName: string) => {
    if (!confirm(`Are you sure you want to PERMANENTLY DELETE "${agentName}"?\n\nThis action cannot be undone. The agent will be removed from:\n- Marketplace\n- All user purchases\n- Database\n\nType "DELETE" to confirm.`)) {
      return
    }

    const confirmText = prompt(`Type "DELETE" to confirm deletion of "${agentName}":`);
    if (confirmText !== 'DELETE') {
      alert('Deletion cancelled. You must type "DELETE" exactly to confirm.');
      return
    }

    try {
      setActionLoading(agentId)

      console.log('Deleting agent and all related data:', agentId)

      await supabase.from('user_agents').delete().eq('agent_id', agentId)
      await supabase.from('agent_executions').delete().eq('agent_id', agentId)

      const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', agentId)

      if (error) throw error

      console.log('Agent deleted successfully')
      alert(`"${agentName}" has been permanently deleted from the marketplace.`)

      await loadAgents()

    } catch (error) {
      console.error('Error deleting agent:', error)
      alert(`Failed to delete agent: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <ModernBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading Admin Panel...</p>
          </div>
        </div>
      </ModernBackground>
    )
  }

  if (!user) {
    return (
      <ModernBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
            <p>Admin access required</p>
          </div>
        </div>
      </ModernBackground>
    )
  }

  return (
    <ModernBackground>
      <ModernHeader user={user} />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Admin Panel</h1>
            <p className="text-gray-400">Manage AI agents in the marketplace</p>
            <p className="text-sm text-gray-500 mb-4">Logged in as: {user.email}</p>

            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-2 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center">
              <h3 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-2">{agents.length}</h3>
              <p className="text-gray-300">Total Agents</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center">
              <h3 className="text-3xl font-bold text-green-400 mb-2">{agents.filter(a => a.is_active).length}</h3>
              <p className="text-gray-300">Active Agents</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center">
              <h3 className="text-3xl font-bold text-red-400 mb-2">{agents.filter(a => !a.is_active).length}</h3>
              <p className="text-gray-300">Inactive Agents</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300"
            >
              {showForm ? 'Hide Form' : '➕ Deploy New Agent'}
            </button>

            {showForm && (
              <button
                onClick={fillSampleData}
                className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                🧪 Fill Sample Data
              </button>
            )}
          </div>

          {/* Deploy New Agent Form */}
          {showForm && (
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 mb-8">
              <h2 className="text-2xl font-bold text-white mb-6 text-center">
                Deploy New Agent
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-gray-300 font-medium mb-2">Agent Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="e.g., SEO Content Analyzer"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 font-medium mb-2">Category *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      required
                    >
                      <option value="">Select Category</option>
                      <option value="SEO">SEO</option>
                      <option value="Content">Content</option>
                      <option value="Social Media">Social Media</option>
                      <option value="Analytics">Analytics</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Development">Development</option>
                      <option value="Design">Design</option>
                      <option value="Business">Business</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* MULTI-CURRENCY PRICING SECTION */}
                <MultiCurrencyPricingForm
                  initialPricing={agentPricing}
                  onPricingChange={handlePricingChange}
                />

                {/* Webhook URL */}
                <div>
                  <label className="block text-gray-300 font-medium mb-2">n8n Webhook URL *</label>
                  <input
                    type="url"
                    value={formData.webhook_url}
                    onChange={(e) => setFormData({...formData, webhook_url: e.target.value})}
                    placeholder="https://n8n.irizpro.com/webhook/your-webhook-id"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    required
                  />
                </div>

                {/* Agent Description */}
                <div>
                  <label className="block text-gray-300 font-medium mb-2">Agent Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Describe what this agent does, its benefits, and capabilities..."
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                    required
                  />
                </div>

                {/* User Inputs Toggle */}
                <div className="bg-white/5 border border-purple-500/50 rounded-lg p-4">
                  <label className="flex items-center space-x-3 cursor-pointer mb-4">
                    <input
                      type="checkbox"
                      checked={requiresInputs}
                      onChange={(e) => setRequiresInputs(e.target.checked)}
                      className="w-5 h-5 text-cyan-400 bg-white/5 border-white/10 rounded focus:ring-cyan-500"
                    />
                    <div>
                      <span className="text-purple-400 font-medium">🛠 This agent requires user inputs</span>
                      <p className="text-sm text-gray-400">Check this if users need to provide data before executing this agent</p>
                    </div>
                  </label>

                  {/* Input Fields Editor */}
                  {requiresInputs && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center flex-wrap gap-4">
                        <h4 className="text-lg text-purple-300 font-medium">Input Fields Configuration</h4>
                        <div className="flex gap-2 flex-wrap">
                          <button type="button" onClick={() => addFormField('text')} className="px-3 py-1 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm rounded-lg">
                            📝 Text
                          </button>
                          <button type="button" onClick={() => addFormField('textarea')} className="px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm rounded-lg">
                            📄 Textarea
                          </button>
                          <button type="button" onClick={() => addFormField('select')} className="px-3 py-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm rounded-lg">
                            📋 Dropdown
                          </button>
                          <button type="button" onClick={() => addFormField('number')} className="px-3 py-1 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white text-sm rounded-lg">
                            🔢 Number
                          </button>
                          <button type="button" onClick={() => addFormField('email')} className="px-3 py-1 bg-gradient-to-r from-pink-500 to-pink-600 text-white text-sm rounded-lg">
                            📧 Email
                          </button>
                          <button type="button" onClick={() => addFormField('url')} className="px-3 py-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm rounded-lg">
                            🔗 URL
                          </button>
                          <button type="button" onClick={() => addFormField('upload')} className="px-3 py-1 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-sm rounded-lg">
                            📁 Upload
                          </button>
                        </div>
                      </div>

                      {/* Dynamic Form Fields */}
                      <div className="space-y-4 max-h-80 overflow-y-auto">
                        {formFields.map((field, index) => (
                          <div key={field.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-3">
                              <h5 className="text-purple-300 font-medium">Field {index + 1}: {field.type}</h5>
                              <div className="flex gap-2">
                                {index > 0 && (
                                  <button type="button" onClick={() => moveFormField(field.id, 'up')} className="px-2 py-1 bg-white/5 hover:bg-white/10 text-white text-xs rounded">
                                    ↑
                                  </button>
                                )}
                                {index < formFields.length - 1 && (
                                  <button type="button" onClick={() => moveFormField(field.id, 'down')} className="px-2 py-1 bg-white/5 hover:bg-white/10 text-white text-xs rounded">
                                    ↓
                                  </button>
                                )}
                                <button type="button" onClick={() => removeFormField(field.id)} className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded">
                                  ✕
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-300 mb-1">Field Name (API)</label>
                                <input
                                  type="text"
                                  value={field.name}
                                  onChange={(e) => updateFormField(field.id, 'name', e.target.value)}
                                  placeholder="e.g., website_url"
                                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-300 mb-1">Display Label</label>
                                <input
                                  type="text"
                                  value={field.label}
                                  onChange={(e) => updateFormField(field.id, 'label', e.target.value)}
                                  placeholder="e.g., Website URL"
                                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm"
                                />
                              </div>
                            </div>

                            <div className="mt-3">
                              <label className="block text-xs text-gray-300 mb-1">Placeholder</label>
                              <input
                                type="text"
                                value={field.placeholder || ''}
                                onChange={(e) => updateFormField(field.id, 'placeholder', e.target.value)}
                                placeholder="e.g., https://your-website.com"
                                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm"
                              />
                            </div>

                            {/* Options for select/radio */}
                            {(field.type === 'select' || field.type === 'radio') && (
                              <div className="mt-3">
                                <label className="block text-xs text-gray-300 mb-1">Options</label>
                                <div className="space-y-2">
                                  {field.options?.map((option, optionIndex) => (
                                    <div key={optionIndex} className="flex gap-2">
                                      <input
                                        type="text"
                                        value={option}
                                        onChange={(e) => updateOption(field.id, optionIndex, e.target.value)}
                                        placeholder={`Option ${optionIndex + 1}`}
                                        className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm"
                                      />
                                      {field.options && field.options.length > 1 && (
                                        <button type="button" onClick={() => removeOption(field.id, optionIndex)} className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded">
                                          ✕
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  <button type="button" onClick={() => addOption(field.id)} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded">
                                    + Add Option
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* File upload configuration */}
                            {field.type === 'upload' && (
                              <div className="mt-3 space-y-3">
                                <div>
                                  <label className="block text-xs text-gray-300 mb-1">Accepted File Types</label>
                                  <div className="grid grid-cols-2 gap-2">
                                    {['Images (jpg,png,gif)', 'Documents (pdf)', 'Word Files (doc,docx)', 'Spreadsheets (csv,xlsx)', 'All Files (*)'].map((fileType, idx) => {
                                      const values = ['image/*', 'application/pdf', '.doc,.docx', '.csv,.xlsx', '*'][idx]
                                      return (
                                        <label key={idx} className="flex items-center space-x-2">
                                          <input
                                            type="checkbox"
                                            checked={field.acceptedFileTypes?.includes(values) || false}
                                            onChange={(e) => {
                                              const currentTypes = field.acceptedFileTypes || []
                                              const newTypes = e.target.checked
                                                ? [...currentTypes.filter(t => t !== values), values]
                                                : currentTypes.filter(t => t !== values)
                                              updateFormField(field.id, 'acceptedFileTypes', newTypes)
                                            }}
                                            className="w-3 h-3"
                                          />
                                          <span className="text-xs text-gray-300">{fileType}</span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs text-gray-300 mb-1">Max File Size (MB)</label>
                                    <input
                                      type="number"
                                      value={field.maxFileSize || 10}
                                      onChange={(e) => updateFormField(field.id, 'maxFileSize', parseInt(e.target.value))}
                                      min="1"
                                      max="100"
                                      className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm"
                                    />
                                  </div>
                                  <div className="flex items-center">
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        checked={field.multiple || false}
                                        onChange={(e) => updateFormField(field.id, 'multiple', e.target.checked)}
                                        className="w-3 h-3"
                                      />
                                      <span className="text-xs text-gray-300">Allow Multiple Files</span>
                                    </label>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="mt-3">
                              <label className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={(e) => updateFormField(field.id, 'required', e.target.checked)}
                                  className="w-4 h-4 text-red-500"
                                />
                                <span className="text-xs text-gray-300">Required field</span>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>

                      {formFields.length === 0 && (
                        <div className="text-center py-8 text-gray-500 text-sm">
                          No input fields configured. Click the buttons above to add fields.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Active Toggle */}
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    className="w-5 h-5 text-green-400 bg-white/5 border-white/10 rounded focus:ring-green-400"
                  />
                  <span className="text-green-400 font-medium">✅ Active in Marketplace</span>
                </div>

                {/* Submit Buttons */}
                <div className="flex gap-4 pt-6">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-lg rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Deploying...</span>
                      </span>
                    ) : (
                      '🚀 DEPLOY TO MARKETPLACE'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-4 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Edit Form Modal */}
          {showEditForm && editingAgent && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-slate-900/95 border border-white/10 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="border-b border-white/10 p-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl text-white font-bold">Edit Agent: {editingAgent.name}</h3>
                    <button
                      onClick={() => setShowEditForm(false)}
                      className="text-gray-400 hover:text-red-400 text-2xl"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <form onSubmit={handleUpdateAgent} className="space-y-6">
                    {/* Agent Info Fields - Same structure as create form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-gray-300 font-medium mb-2">Agent Name *</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-gray-300 font-medium mb-2">Category *</label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({...formData, category: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          required
                        >
                          <option value="SEO">SEO</option>
                          <option value="Content">Content</option>
                          <option value="Social Media">Social Media</option>
                          <option value="Analytics">Analytics</option>
                          <option value="Marketing">Marketing</option>
                          <option value="Development">Development</option>
                          <option value="Design">Design</option>
                          <option value="Business">Business</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-300 font-medium mb-2">Description *</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        rows={4}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 font-medium mb-2">Webhook URL *</label>
                      <input
                        type="url"
                        value={formData.webhook_url}
                        onChange={(e) => setFormData({...formData, webhook_url: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        required
                      />
                    </div>

                    {/* PRICING CONFIGURATION */}
                    <MultiCurrencyPricingForm
                      initialPricing={agentPricing}
                      onPricingChange={handlePricingChange}
                    />

                    {/* USER INPUTS CONFIGURATION - Same as create form */}
                    <div className="bg-white/5 border border-purple-500/50 rounded-lg p-4">
                      <label className="flex items-center space-x-3 cursor-pointer mb-4">
                        <input
                          type="checkbox"
                          checked={requiresInputs}
                          onChange={(e) => setRequiresInputs(e.target.checked)}
                          className="w-5 h-5 text-cyan-400 bg-white/5 border-white/10 rounded focus:ring-cyan-500"
                        />
                        <div>
                          <span className="text-purple-400 font-medium">🛠 This agent requires user inputs</span>
                          <p className="text-sm text-gray-400">Check this if users need to provide data before executing this agent</p>
                        </div>
                      </label>

                      {requiresInputs && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center flex-wrap gap-4">
                            <h4 className="text-lg text-purple-300 font-medium">Input Fields Configuration</h4>
                            <div className="flex gap-2 flex-wrap">
                              <button type="button" onClick={() => addFormField('text')} className="px-3 py-1 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm rounded-lg">📝 Text</button>
                              <button type="button" onClick={() => addFormField('textarea')} className="px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm rounded-lg">📄 Textarea</button>
                              <button type="button" onClick={() => addFormField('select')} className="px-3 py-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm rounded-lg">📋 Dropdown</button>
                              <button type="button" onClick={() => addFormField('number')} className="px-3 py-1 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white text-sm rounded-lg">🔢 Number</button>
                              <button type="button" onClick={() => addFormField('email')} className="px-3 py-1 bg-gradient-to-r from-pink-500 to-pink-600 text-white text-sm rounded-lg">📧 Email</button>
                              <button type="button" onClick={() => addFormField('url')} className="px-3 py-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm rounded-lg">🔗 URL</button>
                              <button type="button" onClick={() => addFormField('upload')} className="px-3 py-1 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-sm rounded-lg">📁 Upload</button>
                            </div>
                          </div>

                          <div className="space-y-4 max-h-60 overflow-y-auto">
                            {formFields.map((field, index) => (
                              <div key={field.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                                {/* Same field editor as create form - abbreviated for space */}
                                <div className="flex justify-between items-center mb-3">
                                  <h5 className="text-purple-300 font-medium">Field {index + 1}: {field.type}</h5>
                                  <div className="flex gap-2">
                                    {index > 0 && <button type="button" onClick={() => moveFormField(field.id, 'up')} className="px-2 py-1 bg-white/5 hover:bg-white/10 text-white text-xs rounded">↑</button>}
                                    {index < formFields.length - 1 && <button type="button" onClick={() => moveFormField(field.id, 'down')} className="px-2 py-1 bg-white/5 hover:bg-white/10 text-white text-xs rounded">↓</button>}
                                    <button type="button" onClick={() => removeFormField(field.id)} className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded">✕</button>
                                  </div>
                                </div>
                                {/* Rest of field configuration same as create form */}
                              </div>
                            ))}
                          </div>

                          {formFields.length === 0 && (
                            <div className="text-center py-8 text-gray-500 text-sm">
                              No input fields configured. Click the buttons above to add fields.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                        className="w-5 h-5 text-green-400 bg-white/5 border-white/10 rounded focus:ring-green-400"
                      />
                      <span className="text-green-400 font-medium">✅ Active in Marketplace</span>
                    </div>

                    <div className="flex gap-4 pt-6">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-lg rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 disabled:opacity-50"
                      >
                        {submitting ? 'UPDATING...' : 'UPDATE AGENT'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEditForm(false)}
                        className="px-6 py-4 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Agents List */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Marketplace Agents ({agents.length})</h2>

            {agents.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🤖</div>
                <p className="text-gray-400 text-lg">No agents deployed yet</p>
                <p className="text-gray-500">Deploy your first AI agent to get started!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-4 text-cyan-400 font-semibold">Name</th>
                      <th className="text-left py-3 px-4 text-cyan-400 font-semibold">Category</th>
                      <th className="text-left py-3 px-4 text-cyan-400 font-semibold">Pricing</th>
                      <th className="text-left py-3 px-4 text-cyan-400 font-semibold">Status</th>
                      <th className="text-left py-3 px-4 text-cyan-400 font-semibold">Created</th>
                      <th className="text-left py-3 px-4 text-cyan-400 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent) => (
                      <tr key={agent.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-4 px-4">
                          <div>
                            <div className="font-medium text-white">{agent.name}</div>
                            <div className="text-sm text-gray-400 max-w-xs truncate">{agent.description}</div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-2 py-1 rounded text-sm">
                            {agent.category}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-white font-medium">
                            ₹{agent.pricing_config?.basePrice || agent.credit_cost}
                          </div>
                          {agent.pricing_config?.customPrices && Object.keys(agent.pricing_config.customPrices).length > 0 && (
                            <div className="text-xs text-gray-400">
                              +{Object.keys(agent.pricing_config.customPrices).length} custom
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded text-sm ${
                            agent.is_active
                              ? 'bg-green-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}>
                            {agent.is_active ? '✅ Active' : '❌ Inactive'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-400 text-sm">
                          {new Date(agent.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => startEdit(agent)}
                              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-1 rounded text-sm hover:shadow-lg transition-all"
                            >
                              ✏️ Edit
                            </button>

                            <button
                              onClick={() => handleToggleActive(agent.id, agent.is_active)}
                              disabled={actionLoading === agent.id}
                              className={`px-3 py-1 rounded text-sm transition-colors ${
                                agent.is_active
                                  ? 'bg-red-600 hover:bg-red-700 text-white'
                                  : 'bg-green-600 hover:bg-green-700 text-white'
                              } disabled:opacity-50`}
                            >
                              {actionLoading === agent.id ? '...' : (agent.is_active ? '❌' : '✅')}
                            </button>

                            <button
                              onClick={() => handleDeleteAgent(agent.id, agent.name)}
                              disabled={actionLoading === agent.id}
                              className="bg-red-700 hover:bg-red-800 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModernBackground>
  )
}

// MULTI-CURRENCY PRICING COMPONENT
interface MultiCurrencyPricingFormProps {
  initialPricing: PricingConfig
  onPricingChange: (pricing: PricingConfig) => void
}

function MultiCurrencyPricingForm({ initialPricing, onPricingChange }: MultiCurrencyPricingFormProps) {
  const [enableCustomPricing, setEnableCustomPricing] = useState(
    Object.keys(initialPricing.customPrices).length > 0
  )

  const updatePricing = (basePrice: number, customPrices: { [currency: string]: number }) => {
    const newPricing: PricingConfig = {
      basePrice,
      customPrices: enableCustomPricing ? customPrices : {}
    }
    onPricingChange(newPricing)
  }

  const handleBasePriceChange = (value: number) => {
    updatePricing(value, initialPricing.customPrices)
  }

  const handleCustomPriceChange = (currency: string, value: string) => {
    const numValue = parseFloat(value) || 0
    const newCustomPrices = { ...initialPricing.customPrices }

    if (numValue > 0) {
      newCustomPrices[currency] = numValue
    } else {
      delete newCustomPrices[currency]
    }

    updatePricing(initialPricing.basePrice, newCustomPrices)
  }

  const toggleCustomPricing = (enabled: boolean) => {
    setEnableCustomPricing(enabled)
    if (!enabled) {
      updatePricing(initialPricing.basePrice, {})
    }
  }

  return (
    <div className="bg-white/5 border border-cyan-500/50 rounded-lg p-6">
      <h3 className="text-xl font-bold text-cyan-400 mb-4">💰 Pricing Configuration</h3>

      <div className="space-y-4">
        {/* Base Price */}
        <div>
          <label className="block text-gray-300 font-medium mb-2">
            Base Price (INR) *
          </label>
          <div className="flex items-center space-x-2">
            <span className="text-gray-300">₹</span>
            <input
              type="number"
              value={initialPricing.basePrice}
              onChange={(e) => handleBasePriceChange(Number(e.target.value))}
              min="1"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>
        </div>

        {/* Custom Pricing Toggle */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="customPricing"
              checked={enableCustomPricing}
              onChange={(e) => toggleCustomPricing(e.target.checked)}
              className="rounded border-white/10 text-cyan-500 focus:ring-cyan-500"
            />
            <label htmlFor="customPricing" className="text-sm font-medium text-cyan-300">
              Enable Custom Regional Pricing
            </label>
          </div>
        </div>

        {/* Custom Pricing Inputs */}
        {enableCustomPricing && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* USD */}
            <div>
              <label className="block text-gray-300 font-medium mb-2">
                🇺🇸 USD
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-gray-300">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={initialPricing.customPrices.USD || ''}
                  onChange={(e) => handleCustomPriceChange('USD', e.target.value)}
                  placeholder="Auto-convert"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* AED */}
            <div>
              <label className="block text-gray-300 font-medium mb-2">
                🇦🇪 AED
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-gray-300">د.إ</span>
                <input
                  type="number"
                  step="0.01"
                  value={initialPricing.customPrices.AED || ''}
                  onChange={(e) => handleCustomPriceChange('AED', e.target.value)}
                  placeholder="Auto-convert"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* EUR */}
            <div>
              <label className="block text-gray-300 font-medium mb-2">
                🇪🇺 EUR
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-gray-300">€</span>
                <input
                  type="number"
                  step="0.01"
                  value={initialPricing.customPrices.EUR || ''}
                  onChange={(e) => handleCustomPriceChange('EUR', e.target.value)}
                  placeholder="Auto-convert"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Pricing Preview */}
        <div className="mt-4 p-4 bg-white/5 rounded-lg">
          <h4 className="text-sm font-medium text-gray-300 mb-2">📊 Pricing Preview</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-cyan-400 font-medium">₹{initialPricing.basePrice}</div>
              <div className="text-gray-500">India (Base)</div>
            </div>
            <div className="text-center">
              <div className="text-green-400 font-medium">
                ${initialPricing.customPrices.USD || (initialPricing.basePrice * 0.012).toFixed(2)}
              </div>
              <div className="text-gray-500">
                USA {initialPricing.customPrices.USD ? '(Custom)' : '(Auto)'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-blue-400 font-medium">
                د.إ{initialPricing.customPrices.AED || (initialPricing.basePrice * 0.044).toFixed(2)}
              </div>
              <div className="text-gray-500">
                UAE {initialPricing.customPrices.AED ? '(Custom)' : '(Auto)'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-purple-400 font-medium">
                €{initialPricing.customPrices.EUR || (initialPricing.basePrice * 0.011).toFixed(2)}
              </div>
              <div className="text-gray-500">
                Europe {initialPricing.customPrices.EUR ? '(Custom)' : '(Auto)'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
