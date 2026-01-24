"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getRegistrationState, saveRegistrationState, ConversationTurn } from "@/lib/news/registration-state";

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface QuestionComponentProps {
  question: string;
  questionIndex: number;
  totalQuestions: number;
  answer: string;
  onAnswerChange: (answer: string) => void;
  isLastQuestion: boolean;
  isGenerating: boolean;
}

function QuestionComponent({
  question,
  questionIndex,
  totalQuestions,
  answer,
  onAnswerChange,
  isLastQuestion,
  isGenerating,
}: QuestionComponentProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Question {questionIndex + 1} of {totalQuestions}
        </h3>
        <div className="w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((questionIndex + 1) / totalQuestions) * 100}%` }}
          ></div>
        </div>
      </div>
      
      <div>
        <label className="block text-base font-medium text-gray-900 dark:text-gray-100 mb-3">
          {question}
        </label>
        <textarea
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="Type your answer here..."
          required
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>
    </div>
  );
}

export default function QuestionsPage() {
  const router = useRouter();
  const [clarifyingQuestions, setClarifyingQuestions] = useState<string[]>([]);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const state = getRegistrationState();
    if (!state || !state.clarifyingQuestions || state.clarifyingQuestions.length === 0) {
      router.push("/news/register");
      return;
    }
    setClarifyingQuestions(state.clarifyingQuestions);
    setConversation(state.conversation || []);
    
    // Initialize answers array from conversation if available
    const initialAnswers = state.clarifyingQuestions.map((_, index) => 
      state.conversation && state.conversation[index] 
        ? state.conversation[index].answer 
        : ""
    );
    setAnswers(initialAnswers);
    
    // Set current question to first unanswered question
    const firstUnanswered = initialAnswers.findIndex(answer => !answer.trim());
    if (firstUnanswered !== -1) {
      setCurrentQuestionIndex(firstUnanswered);
    } else {
      setCurrentQuestionIndex(state.clarifyingQuestions.length - 1);
    }
  }, [router]);

  const handleAnswerChange = (answer: string) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = answer;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (!answers[currentQuestionIndex]?.trim()) return;
    
    // Save current answer to conversation
    const newConversation = [
      ...conversation.slice(0, currentQuestionIndex),
      {
        question: clarifyingQuestions[currentQuestionIndex],
        answer: answers[currentQuestionIndex].trim(),
      },
    ];
    setConversation(newConversation);
    saveRegistrationState({ conversation: newConversation });

    if (currentQuestionIndex < clarifyingQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Last question - generate enhanced description
      generateEnhancedDescription(newConversation);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const generateEnhancedDescription = async (conv: ConversationTurn[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const state = getRegistrationState();
      if (!state) {
        router.push("/news/register");
        return;
      }

      const validInterests = state.interests.filter(interest => interest.trim() !== "");

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
            saveRegistrationState({ selectedCounties: countiesData.counties || [] });
          }
        } catch (countyError) {
          console.error("Failed to determine counties:", countyError);
        }

        router.push("/news/register/review");
      } else {
        setError(data.error || "Failed to generate preferences");
        setIsLoading(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.push("/news/register");
  };

  if (clarifyingQuestions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  const currentQuestion = clarifyingQuestions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === clarifyingQuestions.length - 1;
  const canProceed = answers[currentQuestionIndex]?.trim() || false;

  return (
    <div className="flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
      <div className="px-2 sm:px-4 max-w-4xl mx-auto w-full py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm p-6 mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Let&apos;s refine your interests
            </h2>

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

          {isLoading && isLastQuestion && !canProceed ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Generating your preferences...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <QuestionComponent
                question={currentQuestion}
                questionIndex={currentQuestionIndex}
                totalQuestions={clarifyingQuestions.length}
                answer={answers[currentQuestionIndex] || ""}
                onAnswerChange={handleAnswerChange}
                isLastQuestion={isLastQuestion}
                isGenerating={isLoading}
              />

              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={currentQuestionIndex === 0 ? handleBack : handlePrevious}
                >
                  <BackIcon className="w-4 h-4 mr-2" />
                  {currentQuestionIndex === 0 ? "Back" : "Previous"}
                </Button>
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={isLoading || !canProceed}
                  className="bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                >
                  {isLoading
                    ? "Processing..."
                    : isLastQuestion
                      ? "Generate Summary"
                      : "Next Question"}
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
