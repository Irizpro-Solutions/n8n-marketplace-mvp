'use client';

import { useState, useEffect } from 'react';
import { X, Check, AlertCircle, RefreshCw, Unplug, Plus, KeyRound } from 'lucide-react';
import PlatformCredentialsForm from './PlatformCredentialsForm';

interface PlatformStatus {
  slug: string;
  name: string;
  connected: boolean;
  metadata?: any;
}

interface CredentialManagementSidebarProps {
  agentId: string;
  agentName: string;
  requiredPlatforms: string[];
  isOpen: boolean;
  onClose: () => void;
  onCredentialsUpdated?: () => void;
}

export default function CredentialManagementSidebar({
  agentId,
  agentName,
  requiredPlatforms,
  isOpen,
  onClose,
  onCredentialsUpdated,
}: CredentialManagementSidebarProps) {
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // Load platform status when sidebar opens or agent changes
  useEffect(() => {
    if (isOpen) {
      loadPlatformStatus();
    }
  }, [isOpen, agentId, requiredPlatforms]);

  const loadPlatformStatus = async () => {
    try {
      setLoading(true);

      // Get credential status from API
      const response = await fetch(`/api/credentials/status?agentId=${agentId}`);
      const data = await response.json();

      console.log('[Sidebar] Loaded credential status:', {
        agentId,
        hasAllCredentials: data.has_all_credentials,
        missingPlatforms: data.missing_platforms,
        requiredPlatforms: data.required_platforms,
        credentialsArray: data.credentials,
        credentialsLength: data.credentials?.length,
        credentialsRaw: JSON.stringify(data.credentials, null, 2),
      });

      if (response.ok) {
        const statusMap: Record<string, boolean> = {};
        const metadataMap: Record<string, any> = {};

        data.credentials?.forEach((cred: any) => {
          // Handle both field names: platform_slug (from DB) or platform (from listAgentCredentials)
          const platformSlug = cred.platform_slug || cred.platform;
          statusMap[platformSlug] = cred.is_active;
          metadataMap[platformSlug] = cred.metadata;
          console.log('[Sidebar] Credential:', {
            platformSlug,
            isActive: cred.is_active,
            metadata: cred.metadata,
            rawCred: cred,
          });
        });

        // Load platform definitions
        const platformDefs = await Promise.all(
          requiredPlatforms.map(async (slug) => {
            const defResponse = await fetch(`/api/credentials/platform-definition?slug=${slug}`);
            if (defResponse.ok) {
              const defData = await defResponse.json();
              return {
                slug,
                name: defData.platform?.platform_name || slug,
                connected: statusMap[slug] || false,
                metadata: metadataMap[slug],
              };
            }
            return {
              slug,
              name: slug,
              connected: statusMap[slug] || false,
              metadata: metadataMap[slug],
            };
          })
        );

        setPlatforms(platformDefs);

        console.log('[Sidebar] Final platform state:', {
          platformDefs,
          connectedCount: platformDefs.filter(p => p.connected).length,
          missingCount: platformDefs.filter(p => !p.connected).length,
        });
      }
    } catch (error) {
      console.error('Failed to load platform status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (platformSlug: string) => {
    setSelectedPlatform(platformSlug);
    setShowCredentialForm(true);
  };

  const handleUpdate = (platformSlug: string) => {
    setSelectedPlatform(platformSlug);
    setShowCredentialForm(true);
  };

  const handleDisconnect = async (platformSlug: string) => {
    if (!confirm(`Disconnect ${platformSlug}? You'll need to reconnect before using this agent.`)) {
      return;
    }

    try {
      setDisconnecting(platformSlug);

      const response = await fetch('/api/credentials/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          platformSlug,
          credentials: {},
          disconnect: true, // Flag to disconnect
        }),
      });

      if (response.ok) {
        await loadPlatformStatus();
        if (onCredentialsUpdated) {
          onCredentialsUpdated();
        }
      } else {
        alert('Failed to disconnect credential');
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      alert('Failed to disconnect credential');
    } finally {
      setDisconnecting(null);
    }
  };

  const handleCredentialSaved = async () => {
    setShowCredentialForm(false);
    setSelectedPlatform(null);

    // Wait a bit for the database to update
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reload platform status to show updated connection state
    await loadPlatformStatus();

    if (onCredentialsUpdated) {
      onCredentialsUpdated();
    }
  };

  const connectedPlatforms = platforms.filter((p) => p.connected);
  const missingPlatforms = platforms.filter((p) => !p.connected);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 bottom-0 w-full md:w-[500px] bg-[#0F172A]/98 backdrop-blur-xl border-l border-white/10 z-50 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                <KeyRound className="w-6 h-6 text-blue-400" />
                Credential Manager
              </h2>
              <p className="text-sm text-gray-400">{agentName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>

          {/* Show credential form if editing/adding */}
          {showCredentialForm && selectedPlatform ? (
            <div className="mb-6">
              <button
                onClick={() => {
                  setShowCredentialForm(false);
                  setSelectedPlatform(null);
                }}
                className="mb-4 text-blue-400 hover:text-blue-300 text-sm flex items-center gap-2"
              >
                ← Back to credential list
              </button>
              <PlatformCredentialsForm
                agentId={agentId}
                agentName={agentName}
                requiredPlatforms={[selectedPlatform]}
                onComplete={handleCredentialSaved}
                onCancel={() => {
                  setShowCredentialForm(false);
                  setSelectedPlatform(null);
                }}
              />
            </div>
          ) : (
            <>
              {/* Loading State */}
              {loading ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading credentials...</p>
                </div>
              ) : (
                <>
                  {/* Connected Platforms */}
                  {connectedPlatforms.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                        <Check className="w-5 h-5" />
                        Connected Platforms ({connectedPlatforms.length})
                      </h3>
                      <div className="space-y-3">
                        {connectedPlatforms.map((platform) => (
                          <div
                            key={platform.slug}
                            className="bg-green-500/10 border border-green-500/30 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                  <h4 className="font-semibold text-white">{platform.name}</h4>
                                </div>
                                {platform.metadata?.account_name && (
                                  <p className="text-xs text-gray-400">
                                    Account: {platform.metadata.account_name}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdate(platform.slug)}
                                className="flex-1 px-3 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/20 transition-colors text-sm flex items-center justify-center gap-2"
                              >
                                <RefreshCw className="w-4 h-4" />
                                Update
                              </button>
                              <button
                                onClick={() => handleDisconnect(platform.slug)}
                                disabled={disconnecting === platform.slug}
                                className="flex-1 px-3 py-2 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                <Unplug className="w-4 h-4" />
                                {disconnecting === platform.slug ? 'Disconnecting...' : 'Disconnect'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing Platforms */}
                  {missingPlatforms.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-orange-400 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Required Credentials ({missingPlatforms.length})
                      </h3>
                      <div className="space-y-3">
                        {missingPlatforms.map((platform) => (
                          <div
                            key={platform.slug}
                            className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                                <h4 className="font-semibold text-white">{platform.name}</h4>
                              </div>
                              <span className="text-xs text-orange-400 font-medium">Not Connected</span>
                            </div>
                            <button
                              onClick={() => handleConnect(platform.slug)}
                              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 flex items-center justify-center gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              Connect {platform.name}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All Connected Message */}
                  {connectedPlatforms.length === platforms.length && platforms.length > 0 && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 text-center">
                      <Check className="w-12 h-12 text-green-400 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-green-400 mb-2">
                        All Credentials Connected!
                      </h3>
                      <p className="text-sm text-gray-400">
                        You're ready to execute this agent
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-300">
            <strong className="block mb-1">🔒 Security & Privacy</strong>
            <ul className="text-xs space-y-1 text-gray-400">
              <li>• Credentials encrypted with AES-256-GCM</li>
              <li>• Only you can access your credentials</li>
              <li>• Update or disconnect anytime</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
