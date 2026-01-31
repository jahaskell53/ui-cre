'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail, Calendar, CheckCircle2, XCircle } from 'lucide-react';

const providers = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Connect your Gmail account',
    icon: '📧',
    color: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
  },
  // {
  //   id: 'outlook',
  //   name: 'Outlook',
  //   description: 'Connect your Outlook account',
  //   icon: '📨',
  //   color: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
  // },
  // {
  //   id: 'yahoo',
  //   name: 'Yahoo',
  //   description: 'Connect your Yahoo account',
  //   icon: '📮',
  //   color: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
  // },
  {
    id: 'icloud',
    name: 'iCloud',
    description: 'Connect your iCloud account',
    icon: '☁️',
    color: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
  },
];

function ConnectEmailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const successParam = searchParams.get('success');
    const errorParam = searchParams.get('error');

    if (successParam === 'true') {
      setSuccess(true);
      setSyncing(true);

      // Check sync status
      checkSyncStatus();
    }

    if (errorParam) {
      setError(getErrorMessage(errorParam));
    }
  }, [searchParams]);

  async function checkSyncStatus() {
    try {
      const response = await fetch('/api/integrations/sync');
      const data = await response.json();

      if (data.integrations && data.integrations.length > 0) {
        const latestIntegration = data.integrations[0];

        if (latestIntegration.status === 'active') {
          setSyncing(false);
          // Redirect to people page after short delay
          setTimeout(() => {
            router.push('/network');
          }, 2000);
        } else if (latestIntegration.status === 'error') {
          setSyncing(false);
          setError('Sync failed. Please try again.');
        } else {
          // Still syncing, check again in 2 seconds
          setTimeout(checkSyncStatus, 2000);
        }
      }
    } catch (err) {
      console.error('Error checking sync status:', err);
      setSyncing(false);
    }
  }

  function getErrorMessage(errorCode: string): string {
    const errorMessages: Record<string, string> = {
      oauth_failed: 'Authorization failed. Please try again.',
      missing_params: 'Missing required parameters.',
      callback_failed: 'Connection failed. Please try again.',
    };

    return errorMessages[errorCode] || 'An error occurred. Please try again.';
  }

  async function handleConnect(providerId: string) {
    setConnecting(providerId);
    setError(null);

    try {
      // Redirect to OAuth flow
      window.location.href = `/api/auth/nylas/authorize?provider=${providerId}`;
    } catch (err) {
      console.error('Error connecting:', err);
      setError('Failed to connect. Please try again.');
      setConnecting(null);
    }
  }

  function handleSkip() {
    router.push('/network');
  }

  if (syncing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Importing your contacts...</CardTitle>
            <CardDescription>
              We're syncing your emails and calendar events. This may take a minute.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (success && !syncing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">All set!</CardTitle>
            <CardDescription>
              Your contacts have been imported successfully. Redirecting...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
              <Calendar className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <CardTitle className="text-3xl">Connect your email</CardTitle>
          <CardDescription className="text-base">
            Import contacts from your email and calendar to build your network automatically
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <XCircle className="h-5 w-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleConnect(provider.id)}
                disabled={connecting !== null}
                className={`flex items-center gap-4 rounded-lg border-2 p-4 text-left transition-all ${provider.color} disabled:opacity-50`}
              >
                <span className="text-3xl">{provider.icon}</span>
                <div className="flex-1">
                  <div className="font-semibold">{provider.name}</div>
                  <div className="text-sm text-gray-600">{provider.description}</div>
                </div>
                {connecting === provider.id && (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
                )}
              </button>
            ))}
          </div>

          <div className="border-t pt-6">
            <Button
              variant="ghost"
              onClick={handleSkip}
              disabled={connecting !== null}
              className="w-full"
            >
              Skip for now
            </Button>
            <p className="mt-2 text-center text-sm text-gray-500">
              You can connect your email later in settings
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConnectEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <ConnectEmailPageContent />
    </Suspense>
  );
}
