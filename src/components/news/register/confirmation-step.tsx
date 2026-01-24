"use client";

import { Button } from "@/components/ui/button";

interface ConfirmationStepProps {
  userEmail: string;
  onBackToNews: () => void;
}

export default function ConfirmationStep({
  userEmail,
  onBackToNews,
}: ConfirmationStepProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm p-8 mb-8 max-w-2xl mx-auto text-center">
      <div className="mb-6">
        <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Successfully Registered!
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Your test newsletter has been sent to {userEmail}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Check your inbox to see your personalized newsletter. You&apos;ll receive newsletters based on your preferences.
        </p>
        <Button
          onClick={onBackToNews}
          className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
        >
          Back to News
        </Button>
      </div>
    </div>
  );
}
