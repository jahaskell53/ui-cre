'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, XCircle } from 'lucide-react';
import { EmailIntegrations } from '@/components/integrations/EmailIntegrations';

function ConnectEmailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const successParam = searchParams.get('success');
    const errorParam = searchParams.get('error');

    if (successParam === 'true') {
      setMessage('Email account connected successfully!');
      setTimeout(() => {
        router.push('/people');
      }, 2000);
    }

    if (errorParam) {
      setError(getErrorMessage(errorParam));
    }
  }, [searchParams, router]);

  function getErrorMessage(errorCode: string): string {
    const errorMessages: Record<string, string> = {
      oauth_failed: 'Authorization failed. Please try again.',
      missing_params: 'Missing required parameters.',
      callback_failed: 'Connection failed. Please try again.',
    };

    return errorMessages[errorCode] || 'An error occurred. Please try again.';
  }

  function handleSkip() {
    router.push('/people');
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-white dark:bg-gray-900">
      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
        <div className="max-w-2xl mx-auto p-6">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm border border-green-200 dark:border-green-800">
              {message}
            </div>
          )}

          <div className="space-y-8">
            {/* Email & Calendar Integrations */}
            <section className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
              <div className="flex flex-col gap-1 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Email & Calendar</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Connect your email and calendar to automatically import and sync your contacts.
                </p>
              </div>
              <EmailIntegrations />
            </section>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handleSkip}
                className="w-full"
              >
                Skip for now
              </Button>
            </div>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              You can connect your email later in settings
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConnectEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    }>
      <ConnectEmailPageContent />
    </Suspense>
  );
}
