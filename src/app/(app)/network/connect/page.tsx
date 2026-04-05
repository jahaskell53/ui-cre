"use client";

import { Suspense, useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { EmailIntegrations } from "@/components/integrations/EmailIntegrations";
import { Button } from "@/components/ui/button";

function ConnectEmailPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<string | null>(null);

    useEffect(() => {
        const successParam = searchParams.get("success");
        const errorParam = searchParams.get("error");

        if (errorParam) {
            setError(getErrorMessage(errorParam));
            return;
        }

        if (successParam === "true") {
            setMessage("Email account connected successfully!");
            setIsSyncing(true);
            setSyncStatus("Syncing your contacts...");

            let attempts = 0;
            const maxAttempts = 60; // 5 minutes max (60 * 5 seconds)
            let intervalId: NodeJS.Timeout;
            let timeoutId: NodeJS.Timeout;

            const poll = async () => {
                try {
                    const response = await fetch("/api/integrations/sync");
                    const data = await response.json();

                    if (data.integrations && data.integrations.length > 0) {
                        const latestIntegration = data.integrations[0];

                        if (latestIntegration.status === "active") {
                            setIsSyncing(false);
                            setSyncStatus("Sync complete!");
                            setMessage("Your contacts have been synced successfully!");
                            clearInterval(intervalId);
                            clearTimeout(timeoutId);
                            // Redirect after showing success
                            setTimeout(() => {
                                router.push("/network");
                            }, 2000);
                            return;
                        } else if (latestIntegration.status === "error") {
                            setIsSyncing(false);
                            setSyncStatus("Sync failed");
                            setError("Failed to sync contacts. Please try syncing again later.");
                            clearInterval(intervalId);
                            clearTimeout(timeoutId);
                            return;
                        } else if (latestIntegration.status === "syncing") {
                            setSyncStatus("Syncing your contacts...");
                        }
                    }

                    attempts++;
                    if (attempts >= maxAttempts) {
                        setIsSyncing(false);
                        setSyncStatus("Sync is taking longer than expected");
                        setError("Sync is still in progress. You can check back later or manually sync from settings.");
                        clearInterval(intervalId);
                        clearTimeout(timeoutId);
                    }
                } catch (err) {
                    console.error("Error checking sync status:", err);
                    attempts++;
                    if (attempts >= maxAttempts) {
                        setIsSyncing(false);
                        setSyncStatus("Unable to check sync status");
                        clearInterval(intervalId);
                        clearTimeout(timeoutId);
                    }
                }
            };

            // Check immediately
            poll();

            // Then poll every 5 seconds
            intervalId = setInterval(poll, 5000);

            // Set timeout as backup
            timeoutId = setTimeout(
                () => {
                    setIsSyncing(false);
                    setSyncStatus("Sync is taking longer than expected");
                    setError("Sync is still in progress. You can check back later or manually sync from settings.");
                    clearInterval(intervalId);
                },
                5 * 60 * 1000,
            ); // 5 minutes

            return () => {
                if (intervalId) clearInterval(intervalId);
                if (timeoutId) clearTimeout(timeoutId);
            };
        }
    }, [searchParams, router]);

    function getErrorMessage(errorCode: string): string {
        const errorMessages: Record<string, string> = {
            oauth_failed: "Authorization failed. Please try again.",
            missing_params: "Missing required parameters.",
            callback_failed: "Connection failed. Please try again.",
        };

        return errorMessages[errorCode] || "An error occurred. Please try again.";
    }

    function handleSkip() {
        router.push("/network");
    }

    return (
        <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-gray-900">
            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
                <div className="mx-auto max-w-2xl p-6">
                    {error && (
                        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    {message && !isSyncing && (
                        <div className="mb-6 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-600 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
                            <span>{message}</span>
                        </div>
                    )}

                    {isSyncing && (
                        <div className="mb-6 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-600 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                            <Loader2 className="mt-0.5 h-5 w-5 flex-shrink-0 animate-spin" />
                            <div className="flex-1">
                                <div className="mb-1 font-medium">{syncStatus || "Syncing your contacts..."}</div>
                                <div className="text-xs text-blue-500 dark:text-blue-400">
                                    Sync is running in the background. You can close this page and check back later.
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-8">
                        {/* Email & Calendar Integrations */}
                        <section className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800/50">
                            <div className="mb-6 flex flex-col gap-1">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Email & Calendar</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Connect your email and calendar to automatically import and sync your contacts.
                                </p>
                            </div>
                            <EmailIntegrations />
                        </section>

                        {/* Actions */}
                        <div className="flex gap-3 pt-4">
                            <Button variant="outline" onClick={handleSkip} className="w-full">
                                Skip for now
                            </Button>
                        </div>
                        <p className="text-center text-sm text-gray-500 dark:text-gray-400">You can connect your email later in settings</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ConnectEmailPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-[400px] items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            }
        >
            <ConnectEmailPageContent />
        </Suspense>
    );
}
