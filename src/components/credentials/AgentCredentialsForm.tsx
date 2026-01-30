'use client';

import { useState } from 'react';

interface AgentCredentialsFormProps {
  agentId: string;
  agentName: string;
  credentialFields: string[]; // Field titles from admin (e.g., ["OpenAI API Key", "WordPress URL"])
  onSave?: () => void;
  onCancel?: () => void;
}

export default function AgentCredentialsForm({
  agentId,
  agentName,
  credentialFields,
  onSave,
  onCancel,
}: AgentCredentialsFormProps) {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Convert field title to key (e.g., "OpenAI API Key" -> "openai_api_key")
  const fieldToKey = (field: string) => {
    return field.toLowerCase().replace(/\s+/g, '_');
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Validate all fields are filled
      const missingFields = credentialFields.filter((field) => {
        const key = fieldToKey(field);
        return !credentials[key] || credentials[key].trim() === '';
      });

      if (missingFields.length > 0) {
        setError(`Please fill in: ${missingFields.join(', ')}`);
        return;
      }

      // Call API to save credentials
      const response = await fetch('/api/credentials/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          credentials,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save credentials');
      }

      setSuccess(true);
      setTimeout(() => {
        if (onSave) onSave();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">
          🔐 Configure Credentials
        </h3>
        <p className="text-gray-400">
          Enter your credentials for <span className="text-cyan-400">{agentName}</span>.
          These will be encrypted and stored securely.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-500/10 border border-green-500/50 rounded-lg text-green-400">
          ✅ Credentials saved successfully!
        </div>
      )}

      <div className="space-y-4 mb-6">
        {credentialFields.map((field) => {
          const key = fieldToKey(field);
          const isPassword =
            field.toLowerCase().includes('key') ||
            field.toLowerCase().includes('password') ||
            field.toLowerCase().includes('secret') ||
            field.toLowerCase().includes('token');

          return (
            <div key={key}>
              <label className="block text-gray-300 font-medium mb-2">
                {field} *
              </label>
              <input
                type={isPassword ? 'password' : 'text'}
                value={credentials[key] || ''}
                onChange={(e) =>
                  setCredentials({
                    ...credentials,
                    [key]: e.target.value,
                  })
                }
                placeholder={`Enter your ${field.toLowerCase()}`}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <span className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Saving...</span>
            </span>
          ) : (
            'Save Credentials'
          )}
        </button>

        {onCancel && (
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-300">
        <strong>🔒 Security:</strong> Your credentials are encrypted before being stored and are never shared with other users.
      </div>
    </div>
  );
}
