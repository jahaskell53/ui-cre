"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";

export default function ConfirmationPage() {
  const router = useRouter();
  const { user } = useUser();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
      <div className="px-2 sm:px-4 max-w-4xl mx-auto w-full py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm p-8 mb-8 max-w-2xl mx-auto text-center">
          <div className="mb-6">
            <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Successfully Registered!
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Your test newsletter has been sent to {user.email}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Check your inbox to see your personalized newsletter. You&apos;ll receive newsletters based on your preferences.
            </p>
            <Button
              onClick={() => router.push('/news')}
              className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
            >
              Back to News
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
