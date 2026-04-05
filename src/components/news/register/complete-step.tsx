"use client";

import CitySelector from "@/components/news/CitySelector";
import LocationSelector from "@/components/news/LocationSelector";
import { Button } from "@/components/ui/button";
import { UsCity } from "@/lib/news/cities";
import { PreferredSendTime } from "@/lib/news/registration-state";

interface CompleteStepProps {
    selectedCounties: string[];
    selectedCities: UsCity[];
    firstName: string;
    timezone: string;
    preferredSendTimes: PreferredSendTime[];
    onCountiesChange: (counties: string[]) => void;
    onCitiesChange: (cities: UsCity[]) => void;
    onFirstNameChange: (name: string) => void;
    onTimezoneChange: (tz: string) => void;
    onPreferredSendTimesChange: (times: PreferredSendTime[]) => void;
    onBack: () => void;
    onSubmit: () => void;
    onStartOver: () => void;
    isLoading: boolean;
    error: string | null;
}

function BackIcon({ className }: { className?: string }) {
    return (
        <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export default function CompleteStep({
    selectedCounties,
    selectedCities,
    firstName,
    timezone,
    preferredSendTimes,
    onCountiesChange,
    onCitiesChange,
    onFirstNameChange,
    onTimezoneChange,
    onPreferredSendTimesChange,
    onBack,
    onSubmit,
    onStartOver,
    isLoading,
    error,
}: CompleteStepProps) {
    const addPreferredSendTime = () => {
        onPreferredSendTimesChange([...preferredSendTimes, { dayOfWeek: 5, hour: 9 }]);
    };

    const updatePreferredSendTime = (index: number, field: "dayOfWeek" | "hour", value: number) => {
        const updated = [...preferredSendTimes];
        updated[index] = {
            ...updated[index],
            [field]: value,
        };
        onPreferredSendTimesChange(updated);
    };

    const removePreferredSendTime = (index: number) => {
        onPreferredSendTimesChange(preferredSendTimes.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit();
    };

    return (
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-600 dark:bg-gray-800">
            <div className="mb-6">
                <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Complete your registration</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">Just a few more details to get you started with your personalized newsletter.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Regions Section */}
                <div>
                    <label className="mb-3 block text-base font-medium text-gray-900 dark:text-gray-100">
                        Selected Regions {selectedCounties.length > 0 && `(${selectedCounties.length})`}
                    </label>
                    {selectedCounties.length > 0 && (
                        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
                            <p className="text-sm text-green-800 dark:text-green-200">
                                ✓ We automatically selected {selectedCounties.length} region{selectedCounties.length !== 1 ? "s" : ""} based on your interests.
                                You can adjust the selection below if needed.
                            </p>
                        </div>
                    )}
                    <LocationSelector selectedLocations={selectedCounties} onChange={onCountiesChange} placeholder="Search or select regions..." />
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {selectedCounties.length === 0
                            ? "Leave empty to include all regions, or select specific regions to focus on"
                            : "Adjust the selection above or leave as-is to continue"}
                    </p>
                </div>

                {/* Cities Section */}
                <div>
                    <label className="mb-3 block text-base font-medium text-gray-900 dark:text-gray-100">
                        Selected Cities {selectedCities.length > 0 && `(${selectedCities.length})`}
                    </label>
                    <CitySelector selectedCities={selectedCities} onChange={onCitiesChange} placeholder="Search or select cities..." />
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Select specific cities to narrow down your news feed further.</p>
                </div>

                {/* Name Input */}
                <div>
                    <label className="mb-2 block text-base font-medium text-gray-900 dark:text-gray-100">
                        Your Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={firstName}
                        onChange={(e) => onFirstNameChange(e.target.value)}
                        placeholder="John Doe"
                        required
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-transparent focus:ring-2 focus:ring-gray-900 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:ring-gray-100"
                    />
                </div>

                {/* Timezone Selection */}
                <div>
                    <label className="mb-2 block text-base font-medium text-gray-900 dark:text-gray-100">
                        What timezone should we use to send your newsletter?
                    </label>
                    <select
                        value={timezone}
                        onChange={(e) => onTimezoneChange(e.target.value)}
                        required
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-gray-900 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:ring-gray-100"
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
                    <label className="mb-2 block text-base font-medium text-gray-900 dark:text-gray-100">
                        When should we send your newsletters? (Select one or more times)
                    </label>
                    <div className="space-y-2">
                        {preferredSendTimes.map((time, index) => (
                            <div key={`${time.dayOfWeek}-${time.hour}-${index}`} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                                <select
                                    value={time.dayOfWeek}
                                    onChange={(e) => updatePreferredSendTime(index, "dayOfWeek", parseInt(e.target.value, 10))}
                                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 sm:w-40 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
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
                                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 sm:w-32 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
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
                                    className="rounded-lg px-3 py-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 dark:hover:bg-red-900/20"
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
                        className="mt-3 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-blue-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 dark:border-gray-600 dark:hover:border-blue-600 dark:hover:bg-blue-900/20"
                    >
                        + Add another send time
                    </button>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">We&apos;ll send your newsletter at these times in your chosen timezone.</p>
                </div>

                {/* Submit Button */}
                <div className="flex justify-between">
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={onBack}>
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
                        type="submit"
                        disabled={isLoading || !firstName.trim() || !timezone.trim() || preferredSendTimes.length === 0}
                        className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                        {isLoading ? "Sending Newsletter..." : "Register and Test Newsletter"}
                    </Button>
                </div>
            </form>

            {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}
        </div>
    );
}
