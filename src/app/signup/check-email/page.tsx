"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { CheckCircle2 } from "lucide-react";

function CheckEmailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const email = searchParams.get("email");
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        const checkAuthStatus = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                // User has confirmed email and has a session
                router.push("/network/connect");
            }
        };

        // Check immediately
        checkAuthStatus();

        // Set up polling every 3 seconds
        intervalId = setInterval(checkAuthStatus, 3000);

        // Also listen for auth state changes (more efficient)
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                router.push("/network/connect");
            }
        });

        // Stop checking after 5 minutes to avoid infinite polling
        const timeoutId = setTimeout(() => {
            setIsChecking(false);
            clearInterval(intervalId);
        }, 5 * 60 * 1000);

        return () => {
            clearInterval(intervalId);
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-gray-900 px-4">
            <div className="w-full max-w-md space-y-6">
                {/* Logo */}
                <div className="flex flex-col items-center gap-4 mb-8">
                    <div className="w-10 h-10 bg-gray-900 dark:bg-gray-100 rounded flex items-center justify-center">
                        <span className="text-white dark:text-gray-900 text-sm font-bold">OM</span>
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Check your email</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            {email ? `We sent a confirmation link to ${email}` : "We sent a confirmation link to your email"}
                        </p>
                    </div>
                </div>

                {/* Success Message */}
                <div className="w-full p-4 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-green-600 dark:text-green-400 text-sm">
                        Check your email for a confirmation link!
                    </p>
                </div>

                {/* Instructions */}
                <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
                    <p>
                        Click the confirmation link in the email to verify your account and complete your signup.
                    </p>
                    <p>
                        This page will automatically redirect you once you've confirmed your email.
                    </p>
                </div>

                {/* Back to Sign Up Link */}
                <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                    <Link href="/signup" className="text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300 font-medium">
                        Back to sign up
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function CheckEmailPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-gray-900 px-4">
                <div className="w-full max-w-md space-y-6">
                    <div className="flex flex-col items-center gap-4 mb-8">
                        <div className="w-10 h-10 bg-gray-900 dark:bg-gray-100 rounded flex items-center justify-center">
                            <span className="text-white dark:text-gray-900 text-sm font-bold">OM</span>
                        </div>
                        <div className="text-center">
                            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Check your email</h1>
                        </div>
                    </div>
                </div>
            </div>
        }>
            <CheckEmailContent />
        </Suspense>
    );
}
