"use client";

import { Button } from "@/components/ui/button";

interface InitialInterestsStepProps {
    interests: string[];
    onInterestsChange: (interests: string[]) => void;
    onSubmit: () => void;
    isLoading: boolean;
}

export default function InitialInterestsStep({ interests, onInterestsChange, onSubmit, isLoading }: InitialInterestsStepProps) {
    const updateInterest = (index: number, value: string) => {
        const newInterests = [...interests];
        newInterests[index] = value;
        onInterestsChange(newInterests);
    };

    const addInterest = () => {
        onInterestsChange([...interests, ""]);
    };

    const removeInterest = (index: number) => {
        if (interests.length > 1) {
            onInterestsChange(interests.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (interests.filter((interest) => interest.trim() !== "").length > 0) {
            onSubmit();
        }
    };

    return (
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-600 dark:bg-gray-800">
            <div className="mb-6">
                <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">What interests you?</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">Tell us what multifamily real estate topics you&apos;d like to stay informed about.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="mb-2 block text-base font-medium text-gray-900 dark:text-gray-100">Your Interests</label>
                    <div className="space-y-3">
                        {interests.map((interest, index) => (
                            <div key={index} className="flex gap-2">
                                <input
                                    type="text"
                                    value={interest}
                                    onChange={(e) => updateInterest(index, e.target.value)}
                                    placeholder={index === 0 ? "Multi-family apartments in Palo Alto" : "Another topic..."}
                                    required={index === 0}
                                    className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-transparent focus:ring-2 focus:ring-gray-900 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:ring-gray-100"
                                />
                                {interests.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeInterest(index)}
                                        className="rounded-lg px-3 py-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 dark:hover:bg-red-900/20"
                                        title="Remove this topic"
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
                                )}
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addInterest}
                            className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Add another topic
                        </button>
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button
                        type="submit"
                        disabled={isLoading || interests.filter((interest) => interest.trim() !== "").length === 0}
                        className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                        {isLoading ? "Processing..." : "Continue"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
