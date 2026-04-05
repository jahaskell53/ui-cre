"use client";

import { Button } from "@/components/ui/button";

interface ConfirmationStepProps {
    userEmail: string;
    onBackToNews: () => void;
}

export default function ConfirmationStep({ userEmail, onBackToNews }: ConfirmationStepProps) {
    return (
        <div className="mx-auto mb-8 max-w-2xl rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-600 dark:bg-gray-800">
            <div className="mb-6">
                <svg className="mx-auto mb-4 h-16 w-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Successfully Registered!</h2>
                <p className="mb-4 text-gray-600 dark:text-gray-300">Your test newsletter has been sent to {userEmail}</p>
                <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                    Check your inbox to see your personalized newsletter. You&apos;ll receive newsletters based on your preferences.
                </p>
                <Button
                    onClick={onBackToNews}
                    className="bg-gray-900 px-6 py-3 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                >
                    Back to News
                </Button>
            </div>
        </div>
    );
}
