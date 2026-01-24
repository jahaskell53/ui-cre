"use client";

import { Button } from "@/components/ui/button";
import { ConversationTurn } from "@/lib/news/registration-state";

interface QuestionsStepProps {
  questions: string[];
  conversation: ConversationTurn[];
  currentQuestionIndex: number;
  currentAnswer: string;
  onAnswerChange: (answer: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onStartOver: () => void;
  isLoading: boolean;
  isLastQuestion: boolean;
  initialInterests: string[];
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function QuestionsStep({
  questions,
  conversation,
  currentQuestionIndex,
  currentAnswer,
  onAnswerChange,
  onPrevious,
  onNext,
  onStartOver,
  isLoading,
  isLastQuestion,
  initialInterests,
}: QuestionsStepProps) {
  const canProceed = currentAnswer.trim() !== "";
  const validInterests = initialInterests.filter(interest => interest.trim() !== "");

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm p-6 mb-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Let&apos;s refine your interests
        </h2>

        {(validInterests.length > 0 || conversation.length > 0) && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-3">
            {validInterests.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Initial interests:</p>
                <ul className="list-disc list-inside space-y-1">
                  {validInterests.map((interest, index) => (
                    <li key={index} className="text-sm text-gray-600 dark:text-gray-400">
                      {interest}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {conversation.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Your answers so far:</p>
                {conversation.map((turn, idx) => (
                  <div key={idx} className="text-sm mb-2">
                    <p className="text-gray-600 dark:text-gray-400 mb-1">Q: {turn.question}</p>
                    <p className="text-gray-900 dark:text-gray-100 font-medium">A: {turn.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Question {currentQuestionIndex + 1} of {questions.length}
          </h3>
          <div className="w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {isLoading && isLastQuestion && !canProceed ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Generating your preferences...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <label className="block text-base font-medium text-gray-900 dark:text-gray-100 mb-3">
              {questions[currentQuestionIndex]}
            </label>
            <textarea
              value={currentAnswer}
              onChange={(e) => onAnswerChange(e.target.value)}
              placeholder="Type your answer here..."
              required
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex justify-between pt-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onPrevious}
                disabled={currentQuestionIndex === 0}
              >
                <BackIcon className="w-4 h-4 mr-2" />
                Previous
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onStartOver}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Start Over
              </Button>
            </div>
            <Button
              type="button"
              onClick={onNext}
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
    </div>
  );
}
