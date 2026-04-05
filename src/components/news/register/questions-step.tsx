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
    const validInterests = initialInterests.filter((interest) => interest.trim() !== "");

    return (
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-600 dark:bg-gray-800">
            <div className="mb-6">
                <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">Let&apos;s refine your interests</h2>

                {(validInterests.length > 0 || conversation.length > 0) && (
                    <div className="mb-6 space-y-3 rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
                        {validInterests.length > 0 && (
                            <div>
                                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Initial interests:</p>
                                <ul className="list-inside list-disc space-y-1">
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
                                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Your answers so far:</p>
                                {conversation.map((turn, idx) => (
                                    <div key={idx} className="mb-2 text-sm">
                                        <p className="mb-1 text-gray-600 dark:text-gray-400">Q: {turn.question}</p>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">A: {turn.answer}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Question {currentQuestionIndex + 1} of {questions.length}
                    </h3>
                    <div className="h-2 w-48 rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                            className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {isLoading && isLastQuestion && !canProceed ? (
                <div className="py-12 text-center">
                    <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
                    <p className="text-gray-600 dark:text-gray-400">Generating your preferences...</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div>
                        <label className="mb-3 block text-base font-medium text-gray-900 dark:text-gray-100">{questions[currentQuestionIndex]}</label>
                        <textarea
                            value={currentAnswer}
                            onChange={(e) => onAnswerChange(e.target.value)}
                            placeholder="Type your answer here..."
                            required
                            rows={4}
                            className="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-transparent focus:ring-2 focus:ring-gray-900 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:ring-gray-100"
                        />
                    </div>

                    <div className="flex justify-between pt-4">
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={onPrevious} disabled={currentQuestionIndex === 0}>
                                <BackIcon className="mr-2 h-4 w-4" />
                                Previous
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={onStartOver}
                                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                            >
                                Start Over
                            </Button>
                        </div>
                        <Button
                            type="button"
                            onClick={onNext}
                            disabled={isLoading || !canProceed}
                            className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                        >
                            {isLoading ? "Processing..." : isLastQuestion ? "Generate Summary" : "Next Question"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
