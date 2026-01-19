"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function CheckEmailContent() {
    const searchParams = useSearchParams();
    const email = searchParams.get("email");

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
                <div className="w-full p-4 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
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
                        Didn't receive the email? Check your spam folder or try signing up again.
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
