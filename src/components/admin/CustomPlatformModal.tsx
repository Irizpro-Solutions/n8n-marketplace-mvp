'use client';

import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

interface FieldDefinition {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  help_text?: string;
}

interface CustomPlatformModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlatformCreated: (platform: any) => void;
}

export default function CustomPlatformModal({
  isOpen,
  onClose,
  onPlatformCreated,
}: CustomPlatformModalProps) {
  const [formData, setFormData] = useState({
    platform_slug: '',
    platform_name: '',
    credential_type: 'api_key',
    description: '',
    setup_instructions: '',
  });

  const [fields, setFields] = useState<FieldDefinition[]>([
    { name: '', label: '', type: 'text', required: true, placeholder: '', help_text: '' },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddField = () => {
    setFields([
      ...fields,
      { name: '', label: '', type: 'text', required: false, placeholder: '', help_text: '' },
    ]);
  };

  const handleRemoveField = (index: number) => {
    if (fields.length === 1) {
      alert('At least one field is required');
      return;
    }
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, key: keyof FieldDefinition, value: any) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], [key]: value };
    setFields(newFields);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.platform_slug || !formData.platform_name) {
      setError('Platform slug and name are required');
      return;
    }

    // Validate slug format (lowercase, no spaces)
    if (!/^[a-z0-9_]+$/.test(formData.platform_slug)) {
      setError('Platform slug must be lowercase letters, numbers, and underscores only');
      return;
    }

    // Validate fields
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      if (!field.name || !field.label) {
        setError(`Field ${i + 1}: Name and label are required`);
        return;
      }
      if (!/^[a-z0-9_]+$/.test(field.name)) {
        setError(`Field ${i + 1}: Name must be lowercase letters, numbers, and underscores only`);
        return;
      }
    }

    try {
      setSubmitting(true);

      const response = await fetch('/api/credentials/platform-definition/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          field_schema: fields,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create platform');
      }

      // Success!
      onPlatformCreated(data.platform);

      // Reset form
      setFormData({
        platform_slug: '',
        platform_name: '',
        credential_type: 'api_key',
        description: '',
        setup_instructions: '',
      });
      setFields([
        { name: '', label: '', type: 'text', required: true, placeholder: '', help_text: '' },
      ]);

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create platform');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-gray-900 to-black border border-white/20 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  ➕ Create Custom Platform
                </h2>
                <p className="text-sm text-gray-400">
                  Define a new credential platform for your agents
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Platform Info */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-semibold text-purple-300">Platform Information</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Platform Slug * <span className="text-xs text-gray-500">(e.g., custom_api)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.platform_slug}
                      onChange={(e) =>
                        setFormData({ ...formData, platform_slug: e.target.value.toLowerCase() })
                      }
                      placeholder="custom_api"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Platform Name *
                    </label>
                    <input
                      type="text"
                      value={formData.platform_name}
                      onChange={(e) => setFormData({ ...formData, platform_name: e.target.value })}
                      placeholder="Custom API"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Credential Type
                  </label>
                  <select
                    value={formData.credential_type}
                    onChange={(e) => setFormData({ ...formData, credential_type: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="api_key">API Key</option>
                    <option value="basic_auth">Basic Auth (Username + Password)</option>
                    <option value="bearer_token">Bearer Token</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this platform"
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Setup Instructions
                  </label>
                  <textarea
                    value={formData.setup_instructions}
                    onChange={(e) =>
                      setFormData({ ...formData, setup_instructions: e.target.value })
                    }
                    placeholder="Help text for users on how to obtain these credentials"
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
              </div>

              {/* Field Schema */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-purple-300">Credential Fields</h3>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Field
                  </button>
                </div>

                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {fields.map((field, index) => (
                    <div
                      key={index}
                      className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-400">Field {index + 1}</span>
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveField(index)}
                            className="p-1 hover:bg-red-500/20 rounded text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Field Name *</label>
                          <input
                            type="text"
                            value={field.name}
                            onChange={(e) =>
                              handleFieldChange(index, 'name', e.target.value.toLowerCase())
                            }
                            placeholder="api_key"
                            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Display Label *</label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                            placeholder="API Key"
                            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Field Type</label>
                          <select
                            value={field.type}
                            onChange={(e) => handleFieldChange(index, 'type', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm"
                          >
                            <option value="text">Text</option>
                            <option value="password">Password</option>
                            <option value="email">Email</option>
                            <option value="url">URL</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2 pt-6">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => handleFieldChange(index, 'required', e.target.checked)}
                            className="w-4 h-4 text-purple-400"
                          />
                          <label className="text-xs text-gray-400">Required field</label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Placeholder</label>
                        <input
                          type="text"
                          value={field.placeholder || ''}
                          onChange={(e) => handleFieldChange(index, 'placeholder', e.target.value)}
                          placeholder="e.g., sk-..."
                          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Help Text</label>
                        <input
                          type="text"
                          value={field.help_text || ''}
                          onChange={(e) => handleFieldChange(index, 'help_text', e.target.value)}
                          placeholder="Additional guidance for this field"
                          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Platform'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
