'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, Calendar, CheckCircle2, Trash2, RefreshCw } from 'lucide-react';

const providers = [
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '📧',
    color: 'bg-red-50 hover:bg-red-100 border-red-200',
  },
  {
    id: 'outlook',
    name: 'Outlook',
    icon: '📨',
    color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
  },
  {
    id: 'yahoo',
    name: 'Yahoo',
    icon: '📮',
    color: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
  },
  {
    id: 'icloud',
    name: 'iCloud',
    icon: '☁️',
    color: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
  },
];

interface Integration {
  id: string;
  user_id: string;
  provider: string;
  email_address: string;
  status: string;
  created_at: string;
  last_sync_at: string | null;
  nylas_grant_id: string;
}

export function EmailIntegrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    loadIntegrations();
  }, []);

  async function loadIntegrations() {
    try {
      const response = await fetch('/api/integrations/sync');
      const data = await response.json();
      setIntegrations(data.integrations || []);
    } catch (error) {
      console.error('Error loading integrations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(providerId: string) {
    setConnecting(providerId);
    // Include redirect parameter to come back to profile page
    const currentPath = window.location.pathname;
    window.location.href = `/api/auth/nylas/authorize?provider=${providerId}&redirect=${encodeURIComponent(currentPath)}`;
  }

  async function handleSync(integration: Integration) {
    setSyncing(integration.id);

    try {
      const response = await fetch('/api/integrations/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grantId: integration.nylas_grant_id,
          userId: integration.user_id,
        }),
      });

      if (response.ok) {
        await loadIntegrations();
      }
    } catch (error) {
      console.error('Error syncing:', error);
    } finally {
      setSyncing(null);
    }
  }

  async function handleDisconnect(integration: Integration) {
    if (!confirm(`Disconnect ${integration.email_address}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/integrations/${integration.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadIntegrations();
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function getProviderConfig(provider: string) {
    return providers.find(p => p.id === provider.toLowerCase()) || providers[0];
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connected Accounts */}
      {integrations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Connected Accounts
          </h3>
          <div className="space-y-2">
            {integrations.map((integration) => {
              const providerConfig = getProviderConfig(integration.provider);
              return (
                <div
                  key={integration.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{providerConfig.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {integration.email_address}
                        </span>
                        {integration.status === 'active' && (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Last synced: {formatDate(integration.last_sync_at)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(integration)}
                      disabled={syncing === integration.id}
                    >
                      {syncing === integration.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      Sync
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(integration)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Account */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {integrations.length > 0 ? 'Add Another Account' : 'Connect Your Email'}
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {providers.map((provider) => (
            <button
              key={provider.id}
              onClick={() => handleConnect(provider.id)}
              disabled={connecting !== null}
              className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all ${provider.color} disabled:opacity-50`}
            >
              <span className="text-2xl">{provider.icon}</span>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{provider.name}</div>
              </div>
              {connecting === provider.id && (
                <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Import contacts from your emails and calendar events automatically
        </p>
      </div>
    </div>
  );
}
