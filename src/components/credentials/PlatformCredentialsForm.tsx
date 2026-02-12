'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface FieldDefinition {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  help_text?: string;
}

interface PlatformDefinition {
  platform_slug: string;
  platform_name: string;
  credential_type: string;
  field_schema: FieldDefinition[];
  description?: string;
  setup_instructions?: string;
}

interface PlatformCredentialsFormProps {
  agentId: string;
  agentName: string;
  requiredPlatforms: string[]; // Platform slugs like ["wordpress", "openai"]
  onComplete?: () => void;
  onCancel?: () => void;
}

export default function PlatformCredentialsForm({
  agentId,
  agentName,
  requiredPlatforms,
  onComplete,
  onCancel,
}: PlatformCredentialsFormProps) {
  const [platforms, setPlatforms] = useState<PlatformDefinition[]>([]);
  const [currentPlatformIndex, setCurrentPlatformIndex] = useState(0);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load platform definitions
  useEffect(() => {
    async function loadPlatforms() {
      try {
        setLoading(true);
        const platformDefs: PlatformDefinition[] = [];

        for (const slug of requiredPlatforms) {
          const response = await fetch(`/api/credentials/platform-definition?slug=${slug}`);
          if (response.ok) {
            const data = await response.json();
            platformDefs.push(data.platform);
          }
        }

        setPlatforms(platformDefs);
      } catch (err) {
        setError('Failed to load credential forms');
        console.error('Load platforms error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadPlatforms();
  }, [requiredPlatforms]);

  const currentPlatform = platforms[currentPlatformIndex];
  const isLastPlatform = currentPlatformIndex === platforms.length - 1;

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!currentPlatform) return;

      // Validate required fields
      const missingFields = currentPlatform.field_schema
        .filter((field) => field.required)
        .filter((field) => {
          const value = credentials[field.name];
          return !value || value.trim() === '';
        });

      if (missingFields.length > 0) {
        setError(`Please fill in: ${missingFields.map((f) => f.label).join(', ')}`);
        return;
      }

      // Build credentials object for this platform
      const platformCredentials: Record<string, string> = {};
      currentPlatform.field_schema.forEach((field) => {
        if (credentials[field.name]) {
          platformCredentials[field.name] = credentials[field.name];
        }
      });

      // Save to API
      const response = await fetch('/api/credentials/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          platformSlug: currentPlatform.platform_slug,
          credentials: platformCredentials,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Save failed:', data);
        throw new Error(data.error || 'Failed to save credentials');
      }

      console.log('✅ Credentials saved successfully:', {
        platform: currentPlatform.platform_slug,
        response: data,
      });

      // Move to next platform or complete
      if (isLastPlatform) {
        // All platforms configured!
        console.log('🎉 All platforms configured!');
        if (onComplete) {
          setTimeout(() => onComplete(), 500);
        }
      } else {
        // Next platform
        setCurrentPlatformIndex(currentPlatformIndex + 1);
        setCredentials({}); // Clear form for next platform
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  const handleSkipBack = () => {
    if (currentPlatformIndex > 0) {
      setCurrentPlatformIndex(currentPlatformIndex - 1);
      setCredentials({});
      setError(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-center">
        <Loader2 className="animate-spin h-8 w-8 mx-auto text-blue-500 mb-4" />
        <p className="text-gray-400">Loading credential forms...</p>
      </div>
    );
  }

  if (!currentPlatform) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
        <p className="text-red-400">No credential platforms found.</p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
      {/* Progress Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
          <span>
            Platform {currentPlatformIndex + 1} of {platforms.length}
          </span>
          <span className="text-blue-400">
            {Math.round(((currentPlatformIndex + 1) / platforms.length) * 100)}% Complete
          </span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-violet-500 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${((currentPlatformIndex + 1) / platforms.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">
          🔐 Configure {currentPlatform.platform_name}
        </h3>
        <p className="text-gray-400 mb-1">
          Setting up credentials for <span className="text-blue-400">{agentName}</span>
        </p>
        {currentPlatform.description && (
          <p className="text-sm text-gray-500">{currentPlatform.description}</p>
        )}
      </div>

      {/* Setup Instructions */}
      {currentPlatform.setup_instructions && (
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-300">
          <strong className="block mb-2">📝 How to get your credentials:</strong>
          <p>{currentPlatform.setup_instructions}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Credential Fields */}
      <div className="space-y-4 mb-6">
        {currentPlatform.field_schema.map((field) => (
          <div key={field.name}>
            <label className="block text-gray-300 font-medium mb-2">
              {field.label} {field.required && <span className="text-red-400">*</span>}
            </label>
            {field.help_text && (
              <p className="text-xs text-gray-500 mb-2">{field.help_text}</p>
            )}
            <input
              type={field.type}
              value={credentials[field.name] || ''}
              onChange={(e) =>
                setCredentials({
                  ...credentials,
                  [field.name]: e.target.value,
                })
              }
              placeholder={field.placeholder}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              required={field.required}
            />
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        {currentPlatformIndex > 0 && (
          <button
            onClick={handleSkipBack}
            disabled={saving}
            className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            Back
          </button>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <span className="flex items-center justify-center space-x-2">
              <Loader2 className="animate-spin h-5 w-5" />
              <span>Saving...</span>
            </span>
          ) : isLastPlatform ? (
            'Save & Continue to Agent'
          ) : (
            `Save & Next Platform`
          )}
        </button>

        {onCancel && currentPlatformIndex === 0 && (
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Security Notice */}
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-300">
        <strong>🔒 Security:</strong> Your credentials are encrypted with AES-256-GCM before
        storage and are never shared with other users.
      </div>
    </div>
  );
}
