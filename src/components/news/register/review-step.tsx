"use client";

import { Button } from "@/components/ui/button";

interface ReviewStepProps {
    preferences: string[];
    onPreferencesChange: (preferences: string[]) => void;
    onBack: () => void;
    onContinue: () => void;
    onStartOver: () => void;
}

function BackIcon({ className }: { className?: string }) {
    return (
        <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export default function ReviewStep({ preferences, onPreferencesChange, onBack, onContinue, onStartOver }: ReviewStepProps) {
    return (
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-600 dark:bg-gray-800">
            <div className="mb-6">
                <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Review your preferences</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Based on our conversation, here are your refined preferences. You can edit or remove any of them.
                </p>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="mb-3 block text-base font-medium text-gray-900 dark:text-gray-100">Your Preferences</label>
                    <div className="space-y-3">
                        {preferences.map((preference, index) => (
                            <div key={index} className="flex items-start gap-2">
                                <div className="mt-3 flex-shrink-0 text-gray-400 dark:text-gray-500">•</div>
                                <textarea
                                    value={preference}
                                    onChange={(e) => {
                                        const newPreferences = [...preferences];
                                        newPreferences[index] = e.target.value;
                                        onPreferencesChange(newPreferences);
                                    }}
                                    rows={2}
                                    className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-gray-900 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:ring-gray-100"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        onPreferencesChange(preferences.filter((_, i) => i !== index));
                                    }}
                                    className="flex-shrink-0 rounded-lg px-3 py-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 dark:hover:bg-red-900/20"
                                    title="Remove this preference"
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                    </svg>
                                </button>
                            </div>
                        ))}
                        {preferences.length === 0 && (
                            <p className="text-sm text-gray-500 italic dark:text-gray-400">No preferences yet. Go back to add some.</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            onPreferencesChange([...preferences, ""]);
                        }}
                        className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-blue-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 dark:border-gray-600 dark:hover:border-blue-600 dark:hover:bg-blue-900/20"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add another preference
                    </button>
                </div>

                <div className="flex justify-between">
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onBack}>
                            <BackIcon className="mr-2 h-4 w-4" />
                            Back
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
                        onClick={onContinue}
                        disabled={preferences.length === 0 || preferences.every((p) => !p.trim())}
                        className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                        Looks Good, Continue
                    </Button>
                </div>
            </div>
        </div>
    );
}
