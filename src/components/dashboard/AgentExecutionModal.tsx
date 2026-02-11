'use client'

import { useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Loader2, Settings } from 'lucide-react'
import ResponseRenderer from '@/components/workflows/ResponseRenderer'

interface AgentExecutionModalProps {
  isOpen: boolean
  onClose: () => void
  agent: any
  onExecute: (inputs: Record<string, string>) => Promise<void>
  executing: boolean
  executionResult: any
  executionError: string | null
  hasCredentials?: boolean
  onManageCredentials?: () => void
}

export default function AgentExecutionModal({
  isOpen,
  onClose,
  agent,
  onExecute,
  executing,
  executionResult,
  executionError,
  hasCredentials = true,
  onManageCredentials,
}: AgentExecutionModalProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({})

  const handleInputChange = (fieldName: string, value: string) => {
    setInputs(prev => ({ ...prev, [fieldName]: value }))
  }

  const handleExecute = async () => {
    await onExecute(inputs)
  }

  const handleClose = () => {
    setInputs({})
    onClose()
  }

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-40" onClose={handleClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-white/10 shadow-2xl transition-all">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-cyan-900/10 to-purple-900/10 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-2xl">
                        {agent.icon_url || '🤖'}
                      </div>
                      <div>
                        <Dialog.Title className="text-xl font-bold text-white">
                          {agent.name}
                        </Dialog.Title>
                        <p className="text-sm text-gray-400">{agent.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleClose}
                      className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                    {executionResult ? (
                      /* Show ONLY Result when execution completes */
                      <div className="p-6">
                        <ResponseRenderer
                          response={executionResult.result}
                          cleanMode={true}
                          showDownload={true}
                        />
                      </div>
                    ) : (
                      /* Show Input Form when no result */
                      <div className="p-6 space-y-6">
                        {/* Credential Warning */}
                        {agent.required_platforms && agent.required_platforms.length > 0 && !hasCredentials && (
                          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
                            <Settings className="w-5 h-5 text-yellow-500 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-yellow-200 font-medium">Credentials Required</p>
                              <p className="text-yellow-200/70 text-sm mt-1">
                                This agent requires credentials to run. Please configure them first.
                              </p>
                              <button
                                onClick={onManageCredentials}
                                className="mt-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200 rounded-lg text-sm font-medium transition-colors"
                              >
                                Manage Credentials
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Input Form */}
                        {agent.input_schema && agent.input_schema.length > 0 && (
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white">Input Parameters</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {agent.input_schema.map((field: any) => (
                                <div key={field.name} className="space-y-2">
                                  <label className="text-sm font-medium text-gray-300">
                                    {field.label}
                                    {field.required && <span className="text-red-400 ml-1">*</span>}
                                  </label>
                                  {field.type === 'textarea' ? (
                                    <textarea
                                      value={inputs[field.name] || ''}
                                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                                      placeholder={field.placeholder || field.label}
                                      required={field.required}
                                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 min-h-[100px]"
                                    />
                                  ) : field.type === 'select' ? (
                                    <select
                                      value={inputs[field.name] || ''}
                                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                                      required={field.required}
                                      className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                      style={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                        color: 'white'
                                      }}
                                    >
                                      <option value="" style={{ backgroundColor: '#0f172a', color: 'white' }}>
                                        Select...
                                      </option>
                                      {field.options?.map((option: string) => (
                                        <option
                                          key={option}
                                          value={option}
                                          style={{
                                            backgroundColor: '#0f172a',
                                            color: 'white',
                                            padding: '10px'
                                          }}
                                        >
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type={field.type || 'text'}
                                      value={inputs[field.name] || ''}
                                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                                      placeholder={field.placeholder || field.label}
                                      required={field.required}
                                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Error Display */}
                        {executionError && (
                          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <p className="text-red-200 text-sm">{executionError}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-white/10 bg-slate-950/80 px-6 py-4 flex items-center justify-between">
                    <div className="text-sm text-gray-400">
                      {executionResult ? (
                        <span className="text-green-400">✓ Execution Complete</span>
                      ) : agent.credit_cost > 0 ? (
                        <span>Cost: <span className="text-cyan-400 font-semibold">{agent.credit_cost}</span> credits per run</span>
                      ) : (
                        <span className="text-green-400">Free for Admin</span>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleClose}
                        className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium transition-colors"
                      >
                        Close
                      </button>
                      {!executionResult && (
                        <button
                          onClick={handleExecute}
                          disabled={executing || !hasCredentials}
                          className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                        >
                          {executing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Executing...
                            </>
                          ) : (
                            'Execute Agent'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}
