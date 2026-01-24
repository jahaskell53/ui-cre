"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LocationSelector from "@/components/news/LocationSelector";
import CitySelector from "@/components/news/CitySelector";
import { UsCity } from "@/lib/news/cities";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";

interface PreferredSendTime {
  dayOfWeek: number;
  hour: number;
}

const DEFAULT_PREFERRED_SEND_TIME: PreferredSendTime = {
  dayOfWeek: 5,
  hour: 9,
};

// Helper function to detect user's timezone
function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

interface ConversationTurn {
  question: string;
  answer: string;
}

type OnboardingStep =
  | "initial-interests"
  | "clarifying-questions"
  | "answering-questions"
  | "review-enhanced"
  | "complete-registration"
  | "confirmation";

export default function RegisterPage() {
  const router = useRouter();
  const { user, profile } = useUser();
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("initial-interests");
  const [interests, setInterests] = useState<string[]>([""]);
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<UsCity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Conversational refinement state
  const [clarifyingQuestions, setClarifyingQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [preferences, setPreferences] = useState<string[]>([]);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [preferredSendTimes, setPreferredSendTimes] = useState<PreferredSendTime[]>([DEFAULT_PREFERRED_SEND_TIME]);

  // Autodetect timezone on component mount
  useEffect(() => {
    const detectedTimezone = detectTimezone();
    setTimezone(detectedTimezone);
  }, []);

  // Set firstName from profile when available
  useEffect(() => {
    if (profile?.full_name) {
      setFirstName(profile.full_name);
    }
  }, [profile]);

  const handleLocationChange = (locations: string[]) => {
    setSelectedCounties(locations);
  };

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

  const addPreferredSendTime = () => {
    setPreferredSendTimes(prev => [...prev, { dayOfWeek: 5, hour: 9 }]);
  };

  const updatePreferredSendTime = (index: number, field: "dayOfWeek" | "hour", value: number) => {
    setPreferredSendTimes(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  const removePreferredSendTime = (index: number) => {
    setPreferredSendTimes(prev => prev.filter((_, i) => i !== index));
  };

  // Step 1: User submits initial interests
  const handleInitialInterestsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validInterests = interests.filter(interest => interest.trim() !== "");
    if (validInterests.length === 0) return;

    setIsLoading(true);
    setError(null);

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
        setClarifyingQuestions(data.questions);
        setCurrentQuestionIndex(0);
        setOnboardingStep("clarifying-questions");
      } else {
        setError(data.error || "Failed to generate questions");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: User answers a question and moves to next
  const handleAnswerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAnswer.trim()) return;

    const newConversation = [
      ...conversation,
      {
        question: clarifyingQuestions[currentQuestionIndex],
        answer: currentAnswer.trim(),
      },
    ];
    setConversation(newConversation);
    setCurrentAnswer("");

    if (currentQuestionIndex < clarifyingQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      generateEnhancedDescription(newConversation);
    }
  };

  // Step 3: Generate enhanced description and determine counties
  const generateEnhancedDescription = async (conv: ConversationTurn[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const validInterests = interests.filter(interest => interest.trim() !== "");

      const response = await fetch("/api/news/refine-interests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "enhance-description",
          interests: validInterests.join(", "),
          conversation: conv,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const generatedPreferences = data.preferences || [];
        setPreferences(generatedPreferences);

        try {
          const countiesResponse = await fetch("/api/news/refine-interests", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "determine-counties",
              interests: validInterests.join(", "),
              conversation: conv,
              preferences: generatedPreferences,
            }),
          });

          const countiesData = await countiesResponse.json();

          if (countiesResponse.ok && countiesData.success) {
            setSelectedCounties(countiesData.counties || []);
          }
        } catch (countyError) {
          console.error("Failed to determine counties:", countyError);
        }

        setOnboardingStep("review-enhanced");
      } else {
        setError(data.error || "Failed to generate preferences");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: User reviews and can edit the enhanced description
  const handleEnhancedReview = () => {
    setOnboardingStep("complete-registration");
  };

  // Step 5: Complete registration with enhanced interests
  const handleFinalRegistration = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.email) {
      setError("User email not found");
      return;
    }

    if (!timezone.trim()) {
      setError("Please select your timezone");
      return;
    }

    if (preferredSendTimes.length === 0) {
      setError("Please add at least one preferred send time");
      return;
    }

    setIsLoading(true);
    setError(null);

    const finalInterests = preferences.length > 0
      ? JSON.stringify(preferences)
      : interests.filter(i => i.trim() !== "").join(", ");

    try {
      const response = await fetch("/api/news/send-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          interests: finalInterests,
          counties: selectedCounties.length > 0 ? selectedCounties : undefined,
          cities: selectedCities.length > 0 ? selectedCities.map(c => c.name) : undefined,
          email: user.email,
          firstName: firstName.trim() || undefined,
          timezone: timezone.trim(),
          preferredSendTimes: preferredSendTimes
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        try {
          const sanitizedPreferredSendTimes = preferredSendTimes.map(time => ({
            dayOfWeek: Number(time.dayOfWeek),
            hour: Number(time.hour),
          }));

          const subscribeResponse = await fetch("/api/news/preferences", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              newsletter_active: true,
              newsletter_interests: finalInterests,
              newsletter_timezone: timezone.trim(),
              newsletter_preferred_send_times: sanitizedPreferredSendTimes,
              selected_counties: selectedCounties,
              selected_cities: selectedCities,
            }),
          });

          if (subscribeResponse.ok) {
            setOnboardingStep("confirmation");
          } else {
            const errorData = await subscribeResponse.json();
            setError(errorData.error || "Newsletter sent but subscription failed. Please try again.");
          }
        } catch {
          setError("Newsletter sent but subscription failed. Please try again.");
        }
      } else {
        setError(data.error || "Failed to send newsletter");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

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
        {/* Confirmation Screen */}
        {onboardingStep === "confirmation" && (
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
        )}

        {/* Step 1: Initial Interests */}
        {onboardingStep === "initial-interests" && (
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

              <div className="flex justify-center">
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
        )}

        {/* Step 2: Clarifying Questions */}
        {(onboardingStep === "clarifying-questions" || onboardingStep === "answering-questions") && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm p-6 mb-8">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Let&apos;s refine your interests
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Question {currentQuestionIndex + 1} of {clarifyingQuestions.length}
                </span>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentQuestionIndex + 1) / clarifyingQuestions.length) * 100}%` }}
                ></div>
              </div>

              {conversation.length > 0 && (
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Your answers so far:</p>
                  {conversation.map((turn, idx) => (
                    <div key={idx} className="text-sm">
                      <p className="text-gray-600 dark:text-gray-400 mb-1">Q: {turn.question}</p>
                      <p className="text-gray-900 dark:text-gray-100 font-medium">A: {turn.answer}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isLoading && currentQuestionIndex === clarifyingQuestions.length - 1 && !currentAnswer.trim() ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Generating your preferences...</p>
              </div>
            ) : (
              <form onSubmit={handleAnswerSubmit} className="space-y-6">
                <div>
                  <label className="block text-base font-medium text-gray-900 dark:text-gray-100 mb-3">
                    {clarifyingQuestions[currentQuestionIndex]}
                  </label>
                  <textarea
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    placeholder="Type your answer here..."
                    required
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                <div className="flex justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (currentQuestionIndex > 0) {
                        setCurrentQuestionIndex(currentQuestionIndex - 1);
                        const prevConversation = conversation.slice(0, -1);
                        setConversation(prevConversation);
                        setCurrentAnswer("");
                      } else {
                        setOnboardingStep("initial-interests");
                        setClarifyingQuestions([]);
                        setConversation([]);
                        setCurrentAnswer("");
                        setCurrentQuestionIndex(0);
                      }
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading || !currentAnswer.trim()}
                    className="bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                  >
                    {isLoading
                      ? "Processing..."
                      : currentQuestionIndex < clarifyingQuestions.length - 1
                        ? "Next Question"
                        : "Generate Summary"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Step 3: Review Preferences */}
        {onboardingStep === "review-enhanced" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm p-6 mb-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Review your preferences
              </h2>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Based on our conversation, here are your refined preferences. You can edit or remove any of them.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-base font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Your Preferences
                </label>
                <div className="space-y-3">
                  {preferences.map((preference, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-shrink-0 mt-3 text-gray-400 dark:text-gray-500">
                        •
                      </div>
                      <textarea
                        value={preference}
                        onChange={(e) => {
                          const newPreferences = [...preferences];
                          newPreferences[index] = e.target.value;
                          setPreferences(newPreferences);
                        }}
                        rows={2}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPreferences(preferences.filter((_, i) => i !== index));
                        }}
                        className="flex-shrink-0 px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Remove this preference"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {preferences.length === 0 && (
                    <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                      No preferences yet. Go back to add some.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPreferences([...preferences, ""]);
                  }}
                  className="mt-3 flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add another preference
                </button>
              </div>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    setOnboardingStep("clarifying-questions");
                    setCurrentQuestionIndex(clarifyingQuestions.length - 1);
                  }}
                >
                  Back
                </Button>
                <Button
                  onClick={handleEnhancedReview}
                  disabled={preferences.length === 0 || preferences.every(p => !p.trim())}
                  className="bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                >
                  Looks Good, Continue
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Complete Registration */}
        {onboardingStep === "complete-registration" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm p-6 mb-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Complete your registration
              </h2>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Just a few more details to get you started with your personalized newsletter.
              </p>
            </div>

            <form onSubmit={handleFinalRegistration} className="space-y-6">
              {/* Regions Section */}
              <div>
                <label className="block text-base font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Selected Regions {selectedCounties.length > 0 && `(${selectedCounties.length})`}
                </label>
                {selectedCounties.length > 0 && (
                  <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      ✓ We automatically selected {selectedCounties.length} region{selectedCounties.length !== 1 ? 's' : ''} based on your interests. You can adjust the selection below if needed.
                    </p>
                  </div>
                )}
                <LocationSelector
                  selectedLocations={selectedCounties}
                  onChange={handleLocationChange}
                  placeholder="Search or select regions..."
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {selectedCounties.length === 0
                    ? "Leave empty to include all regions, or select specific regions to focus on"
                    : "Adjust the selection above or leave as-is to continue"
                  }
                </p>
              </div>

              {/* Cities Section */}
              <div>
                <label className="block text-base font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Selected Cities {selectedCities.length > 0 && `(${selectedCities.length})`}
                </label>
                <CitySelector
                  selectedCities={selectedCities}
                  onChange={setSelectedCities}
                  placeholder="Search or select cities..."
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Select specific cities to narrow down your news feed further.
                </p>
              </div>

              {/* Name Input */}
              <div>
                <label className="block text-base font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Your Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John Doe"
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Timezone Selection */}
              <div>
                <label className="block text-base font-medium text-gray-900 dark:text-gray-100 mb-2">
                  What timezone should we use to send your newsletter?
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select timezone</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="UTC">UTC</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                </select>
              </div>

              {/* Preferred Send Times */}
              <div>
                <label className="block text-base font-medium text-gray-900 dark:text-gray-100 mb-2">
                  When should we send your newsletters? (Select one or more times)
                </label>
                <div className="space-y-2">
                  {preferredSendTimes.map((time, index) => (
                    <div key={`${time.dayOfWeek}-${time.hour}-${index}`} className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                      <select
                        value={time.dayOfWeek}
                        onChange={(e) => updatePreferredSendTime(index, "dayOfWeek", parseInt(e.target.value, 10))}
                        className="flex-1 sm:w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value={0}>Sunday</option>
                        <option value={1}>Monday</option>
                        <option value={2}>Tuesday</option>
                        <option value={3}>Wednesday</option>
                        <option value={4}>Thursday</option>
                        <option value={5}>Friday</option>
                        <option value={6}>Saturday</option>
                      </select>
                      <select
                        value={time.hour}
                        onChange={(e) => updatePreferredSendTime(index, "hour", parseInt(e.target.value, 10))}
                        className="flex-1 sm:w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>
                            {i.toString().padStart(2, "0")}:00
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removePreferredSendTime(index)}
                        className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        disabled={preferredSendTimes.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addPreferredSendTime}
                  className="mt-3 px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600"
                >
                  + Add another send time
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  We&apos;ll send your newsletter at these times in your chosen timezone.
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOnboardingStep("review-enhanced")}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isLoading ||
                    !firstName.trim() ||
                    !timezone.trim() ||
                    preferredSendTimes.length === 0
                  }
                  className="bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                >
                  {isLoading ? "Sending Newsletter..." : "Register and Test Newsletter"}
                </Button>
              </div>
            </form>
          </div>
        )}

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
