"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { saveRegistrationState, getRegistrationState, getDefaultState, clearRegistrationState } from "@/lib/news/registration-state";

// Helper function to detect user's timezone
function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { user, profile } = useUser();
  const [interests, setInterests] = useState<string[]>([""]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(true);

  // Check if user is already registered and clear state if so
  useEffect(() => {
    const checkRegistration = async () => {
      try {
        const response = await fetch("/api/news/preferences");
        if (response.ok) {
          const data = await response.json();
          if (data.newsletter_active) {
            // User is already registered, clear any old state
            clearRegistrationState();
          }
        }
      } catch (error) {
        console.error("Failed to check registration status:", error);
      } finally {
        setIsCheckingRegistration(false);
      }
    };

    checkRegistration();
  }, []);

  // Load saved state on mount
  useEffect(() => {
    if (isCheckingRegistration) return;
    
    const saved = getRegistrationState();
    if (saved) {
      setInterests(saved.interests.length > 0 ? saved.interests : [""]);
    } else {
      // Initialize with default state
      const defaultState = getDefaultState();
      defaultState.timezone = detectTimezone();
      if (profile?.full_name) {
        defaultState.firstName = profile.full_name;
      }
      saveRegistrationState(defaultState);
    }
  }, [profile, isCheckingRegistration]);

  const updateInterest = (index: number, value: string) => {
    setInterests(prev => prev.map((interest, i) => i === index ? value : interest));
  };

  const addInterest = () => {
    setInterests(prev => [...prev, ""]);
  };

  const removeInterest = (index: number) => {
    if (interests.length > 1) {
      setInterests(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Step 1: User submits initial interests
  const handleInitialInterestsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validInterests = interests.filter(interest => interest.trim() !== "");
    if (validInterests.length === 0) return;

    setIsLoading(true);
    setError(null);

    // Save interests to state
    saveRegistrationState({ interests: validInterests });

    try {
      const response = await fetch("/api/news/refine-interests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "ask-questions",
          interests: validInterests.join(", "),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Save questions and navigate to questions page
        saveRegistrationState({ clarifyingQuestions: data.questions, conversation: [] });
        router.push("/news/register/questions");
      } else {
        setError(data.error || "Failed to generate questions");
        setIsLoading(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  if (!user || isCheckingRegistration) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
      <div className="px-2 sm:px-4 max-w-4xl mx-auto w-full py-8">
        {/* Step 1: Initial Interests */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm p-6 mb-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                What interests you?
              </h2>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Tell us what multifamily real estate topics you&apos;d like to stay informed about.
              </p>
            </div>

            <form onSubmit={handleInitialInterestsSubmit} className="space-y-6">
              <div>
                <label className="block text-base font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Your Interests
                </label>
                <div className="space-y-3">
                  {interests.map((interest, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={interest}
                        onChange={(e) => updateInterest(index, e.target.value)}
                        placeholder={index === 0 ? "Multi-family apartments in Palo Alto" : "Another topic..."}
                        required={index === 0}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {interests.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeInterest(index)}
                          className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Remove this topic"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addInterest}
                    className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add another topic
                  </button>
                </div>
              </div>

              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/news')}
                >
                  <BackIcon className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || interests.filter(interest => interest.trim() !== "").length === 0}
                  className="bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                >
                  {isLoading ? "Processing..." : "Continue"}
                </Button>
              </div>
            </form>
          </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
