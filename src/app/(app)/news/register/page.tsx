"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { 
  saveRegistrationState, 
  getRegistrationState, 
  getDefaultState, 
  clearRegistrationState,
  ConversationTurn,
  PreferredSendTime
} from "@/lib/news/registration-state";
import RegisterNavBar from "@/components/news/register-nav-bar";
import InitialInterestsStep from "@/components/news/register/initial-interests-step";
import QuestionsStep from "@/components/news/register/questions-step";
import ReviewStep from "@/components/news/register/review-step";
import CompleteStep from "@/components/news/register/complete-step";
import ConfirmationStep from "@/components/news/register/confirmation-step";
import { UsCity } from "@/lib/news/cities";

type RegistrationStep = 
  | "initial-interests"
  | "questions"
  | "review"
  | "complete"
  | "confirmation";

// Helper function to detect user's timezone
function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export default function RegisterPage() {
  const router = useRouter();
  const { user, profile } = useUser();
  
  // Step state
  const [currentStep, setCurrentStep] = useState<RegistrationStep>("initial-interests");
  
  // Form state
  const [interests, setInterests] = useState<string[]>([""]);
  const [clarifyingQuestions, setClarifyingQuestions] = useState<string[]>([]);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [preferences, setPreferences] = useState<string[]>([]);
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<UsCity[]>([]);
  const [firstName, setFirstName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [preferredSendTimes, setPreferredSendTimes] = useState<PreferredSendTime[]>([{ dayOfWeek: 5, hour: 9 }]);
  
  // UI state
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
      setClarifyingQuestions(saved.clarifyingQuestions || []);
      setConversation(saved.conversation || []);
      setPreferences(saved.preferences || []);
      setSelectedCounties(saved.selectedCounties || []);
      setSelectedCities(saved.selectedCities || []);
      setFirstName(saved.firstName || "");
      setTimezone(saved.timezone || detectTimezone());
      setPreferredSendTimes(saved.preferredSendTimes.length > 0 ? saved.preferredSendTimes : [{ dayOfWeek: 5, hour: 9 }]);
      
      // Determine current step based on saved state
      if (saved.preferences && saved.preferences.length > 0) {
        setCurrentStep("review");
      } else if (saved.clarifyingQuestions && saved.clarifyingQuestions.length > 0) {
        setCurrentStep("questions");
        // Set to first unanswered question
        const firstUnanswered = saved.clarifyingQuestions.findIndex((_, idx) => 
          !saved.conversation || !saved.conversation[idx]
        );
        if (firstUnanswered !== -1) {
          setCurrentQuestionIndex(firstUnanswered);
          setCurrentAnswer("");
        } else {
          setCurrentQuestionIndex(saved.clarifyingQuestions.length - 1);
          setCurrentAnswer(saved.conversation?.[saved.clarifyingQuestions.length - 1]?.answer || "");
        }
      }
    } else {
      // Initialize with default state
      const defaultState = getDefaultState();
      defaultState.timezone = detectTimezone();
      if (profile?.full_name) {
        defaultState.firstName = profile.full_name;
        setFirstName(profile.full_name);
      }
      saveRegistrationState(defaultState);
      setTimezone(defaultState.timezone);
    }
  }, [profile, isCheckingRegistration]);

  const handleStartOver = () => {
    clearRegistrationState();
    setCurrentStep("initial-interests");
    setInterests([""]);
    setClarifyingQuestions([]);
    setConversation([]);
    setCurrentQuestionIndex(0);
    setCurrentAnswer("");
    setPreferences([]);
    setSelectedCounties([]);
    setSelectedCities([]);
    setFirstName(profile?.full_name || "");
    setTimezone(detectTimezone());
    setPreferredSendTimes([{ dayOfWeek: 5, hour: 9 }]);
    setError(null);
    
    // Reset to default state
    const defaultState = getDefaultState();
    defaultState.timezone = detectTimezone();
    if (profile?.full_name) {
      defaultState.firstName = profile.full_name;
    }
    saveRegistrationState(defaultState);
  };

  // Step 1: Initial Interests
  const handleInitialInterestsSubmit = async () => {
    const validInterests = interests.filter(interest => interest.trim() !== "");
    if (validInterests.length === 0) return;

    setIsLoading(true);
    setError(null);
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
        setClarifyingQuestions(data.questions);
        setCurrentQuestionIndex(0);
        setCurrentAnswer("");
        setConversation([]);
        saveRegistrationState({ clarifyingQuestions: data.questions, conversation: [] });
        setCurrentStep("questions");
      } else {
        setError(data.error || "Failed to generate questions");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Questions
  const handleQuestionNext = async () => {
    if (!currentAnswer.trim()) return;

    const newConversation = [
      ...conversation.slice(0, currentQuestionIndex),
      {
        question: clarifyingQuestions[currentQuestionIndex],
        answer: currentAnswer.trim(),
      },
    ];
    setConversation(newConversation);
    saveRegistrationState({ conversation: newConversation });

    if (currentQuestionIndex < clarifyingQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCurrentAnswer(newConversation[currentQuestionIndex + 1]?.answer || "");
    } else {
      // Last question - generate enhanced description
      await generateEnhancedDescription(newConversation);
    }
  };

  const handleQuestionPrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setCurrentAnswer(conversation[currentQuestionIndex - 1]?.answer || "");
    }
  };

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
        saveRegistrationState({ preferences: generatedPreferences });

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
            saveRegistrationState({ selectedCounties: countiesData.counties || [] });
          }
        } catch (countyError) {
          console.error("Failed to determine counties:", countyError);
        }

        setCurrentStep("review");
      } else {
        setError(data.error || "Failed to generate preferences");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Review
  const handleReviewContinue = () => {
    saveRegistrationState({ preferences });
    setCurrentStep("complete");
  };

  const handleReviewBack = () => {
    setCurrentStep("questions");
    setCurrentQuestionIndex(clarifyingQuestions.length - 1);
    setCurrentAnswer(conversation[clarifyingQuestions.length - 1]?.answer || "");
  };

  // Step 4: Complete
  const handleCompleteSubmit = async () => {
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

    // Save all state
    saveRegistrationState({
      selectedCounties,
      selectedCities,
      firstName,
      timezone,
      preferredSendTimes,
    });

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
            clearRegistrationState();
            setCurrentStep("confirmation");
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

  const handleCompleteBack = () => {
    setCurrentStep("review");
  };

  // Step 5: Confirmation
  const handleBackToNews = () => {
    router.push("/news");
  };

  const getNavTitle = () => {
    switch (currentStep) {
      case "initial-interests":
        return "Register for Newsletter";
      case "questions":
        return "Refine Your Interests";
      case "review":
        return "Review Preferences";
      case "complete":
        return "Complete Registration";
      case "confirmation":
        return "Registration Complete";
      default:
        return "Register for Newsletter";
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
    <div className="flex flex-col h-full w-full overflow-hidden bg-white dark:bg-gray-900">
      <RegisterNavBar title={getNavTitle()} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
        <div className="px-2 sm:px-4 max-w-4xl mx-auto w-full py-8">
          {currentStep === "initial-interests" && (
            <InitialInterestsStep
              interests={interests}
              onInterestsChange={setInterests}
              onSubmit={handleInitialInterestsSubmit}
              isLoading={isLoading}
            />
          )}

          {currentStep === "questions" && clarifyingQuestions.length > 0 && (
            <QuestionsStep
              questions={clarifyingQuestions}
              conversation={conversation}
              currentQuestionIndex={currentQuestionIndex}
              currentAnswer={currentAnswer}
              onAnswerChange={setCurrentAnswer}
              onPrevious={handleQuestionPrevious}
              onNext={handleQuestionNext}
              onStartOver={handleStartOver}
              isLoading={isLoading}
              isLastQuestion={currentQuestionIndex === clarifyingQuestions.length - 1}
              initialInterests={interests}
            />
          )}

          {currentStep === "review" && (
            <ReviewStep
              preferences={preferences}
              onPreferencesChange={setPreferences}
              onBack={handleReviewBack}
              onContinue={handleReviewContinue}
              onStartOver={handleStartOver}
            />
          )}

          {currentStep === "complete" && (
            <CompleteStep
              selectedCounties={selectedCounties}
              selectedCities={selectedCities}
              firstName={firstName}
              timezone={timezone}
              preferredSendTimes={preferredSendTimes}
              onCountiesChange={(counties) => {
                setSelectedCounties(counties);
                saveRegistrationState({ selectedCounties: counties });
              }}
              onCitiesChange={(cities) => {
                setSelectedCities(cities);
                saveRegistrationState({ selectedCities: cities });
              }}
              onFirstNameChange={(name) => {
                setFirstName(name);
                saveRegistrationState({ firstName: name });
              }}
              onTimezoneChange={(tz) => {
                setTimezone(tz);
                saveRegistrationState({ timezone: tz });
              }}
              onPreferredSendTimesChange={(times) => {
                setPreferredSendTimes(times);
                saveRegistrationState({ preferredSendTimes: times });
              }}
              onBack={handleCompleteBack}
              onSubmit={handleCompleteSubmit}
              onStartOver={handleStartOver}
              isLoading={isLoading}
              error={error}
            />
          )}

          {currentStep === "confirmation" && user?.email && (
            <ConfirmationStep
              userEmail={user.email}
              onBackToNews={handleBackToNews}
            />
          )}

          {/* Error Display */}
          {error && currentStep !== "complete" && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
