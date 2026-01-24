"use client";

import { Button } from "@/components/ui/button";

interface InitialInterestsStepProps {
  interests: string[];
  onInterestsChange: (interests: string[]) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export default function InitialInterestsStep({
  interests,
  onInterestsChange,
  onSubmit,
  isLoading,
}: InitialInterestsStepProps) {
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
    if (interests.filter(interest => interest.trim() !== "").length > 0) {
      onSubmit();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm p-6 mb-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          What interests you?
        </h2>
        <p className="text-gray-600 dark:text-gray-300 text-sm">
          Tell us what multifamily real estate topics you&apos;d like to stay informed about.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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

        <div className="flex justify-end">
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
  );
}
