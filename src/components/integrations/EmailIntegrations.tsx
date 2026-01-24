'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Trash2, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { Modal, ModalOverlay, Dialog } from '@/components/application/modals/modal';

const providers = [
  {
    id: 'gmail',
    name: 'Gmail',
    logo: 'https://www.google.com/gmail/about/static/images/logo-gmail.png',
    color: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
  },
  {
    id: 'outlook',
    name: 'Outlook',
    logo: 'https://mailmeteor.com/logos/assets/PNG/Microsoft_Office_Outlook_Logo_512px.png',
    color: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
  },
  {
    id: 'yahoo',
    name: 'Yahoo',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Yahoo%21_%282019%29.svg',
    color: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
  },
  {
    id: 'icloud',
    name: 'iCloud',
    logo: 'https://pluspng.com/logo-img/ic169icl2bd3-icloud-logo-icloud-logopedia-.png',
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState<Integration | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const pollingIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    loadIntegrations();
    
    // Cleanup polling intervals on unmount
    return () => {
      pollingIntervals.current.forEach((interval) => clearInterval(interval));
      pollingIntervals.current.clear();
    };
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
    // Clear any existing polling for this integration
    const existingInterval = pollingIntervals.current.get(integration.id);
    if (existingInterval) {
      clearInterval(existingInterval);
      pollingIntervals.current.delete(integration.id);
    }

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
        // Poll for sync completion
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const statusResponse = await fetch('/api/integrations/sync');
            const statusData = await statusResponse.json();
            
            if (statusData.integrations) {
              const updatedIntegration = statusData.integrations.find(
                (i: Integration) => i.id === integration.id
              );
              
              if (updatedIntegration) {
                // Stop polling if sync is complete (active) or failed (error)
                if (updatedIntegration.status === 'active' || updatedIntegration.status === 'error') {
                  clearInterval(pollInterval);
                  pollingIntervals.current.delete(integration.id);
                  setSyncing(null);
                  await loadIntegrations();
                  return;
                }
                // Continue polling if still syncing
              } else {
                // Integration not found - might have been deleted, stop polling
                clearInterval(pollInterval);
                pollingIntervals.current.delete(integration.id);
                setSyncing(null);
                await loadIntegrations();
                return;
              }
            }
            
            if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              pollingIntervals.current.delete(integration.id);
              setSyncing(null);
              await loadIntegrations();
            }
          } catch (err) {
            console.error('Error polling sync status:', err);
            if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              pollingIntervals.current.delete(integration.id);
              setSyncing(null);
            }
          }
        }, 5000); // Poll every 5 seconds
        
        pollingIntervals.current.set(integration.id, pollInterval);
      } else {
        setSyncing(null);
      }
    } catch (error) {
      console.error('Error syncing:', error);
      setSyncing(null);
    }
  }

  function handleDisconnectClick(integration: Integration) {
    setIntegrationToDelete(integration);
    setShowDeleteModal(true);
  }

  async function handleDisconnect() {
    if (!integrationToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/integrations/${integrationToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadIntegrations();
        setShowDeleteModal(false);
        setIntegrationToDelete(null);
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
    } finally {
      setIsDeleting(false);
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
      {/* Sync Status Message */}
      {syncing && (
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Loader2 className="h-4 w-4 mt-0.5 flex-shrink-0 animate-spin" />
            <div>
              <div className="font-medium mb-1">Sync in progress</div>
              <div className="text-xs text-blue-500 dark:text-blue-400">
                Sync is running in the background. You can close this page and check back later.
              </div>
            </div>
          </div>
        </div>
      )}

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
                  className="flex flex-col gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                      <Image
                        src={providerConfig.logo}
                        alt={providerConfig.name}
                        width={32}
                        height={32}
                        className="object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {integration.email_address}
                        </span>
                        {integration.status === 'active' && (
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Last synced: {formatDate(integration.last_sync_at)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(integration)}
                      disabled={syncing === integration.id}
                    >
                      {syncing === integration.id ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3" />
                          Sync
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnectClick(integration)}
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
              <div className="w-8 h-8 flex items-center justify-center">
                <Image
                  src={provider.logo}
                  alt={provider.name}
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
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

      {/* Delete Confirmation Modal */}
      <ModalOverlay
        isOpen={showDeleteModal}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setShowDeleteModal(false);
            setIntegrationToDelete(null);
          }
        }}
      >
        <Modal className="max-w-md bg-white dark:bg-gray-900 shadow-xl rounded-xl border border-gray-200 dark:border-gray-800">
          <Dialog className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Disconnect Email
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to disconnect {integrationToDelete?.email_address}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setIntegrationToDelete(null);
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={isDeleting}
              >
                {isDeleting ? "Disconnecting..." : "Disconnect"}
              </Button>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
  );
}
