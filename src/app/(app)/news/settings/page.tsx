"use client";

import { useEffect, useState } from "react";
import { Clock, Globe, Loader2, MapPin, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import CitySelector from "@/components/news/CitySelector";
import LocationSelector from "@/components/news/LocationSelector";
import { Button } from "@/components/ui/button";
import { UsCity } from "@/lib/news/cities";
import { clearRegistrationState } from "@/lib/news/registration-state";

function BackIcon({ className }: { className?: string }) {
    return (
        <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

interface PreferredSendTime {
    dayOfWeek: number;
    hour: number;
}

const TIMEZONES = [
    { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
    { value: "America/Denver", label: "Mountain Time (MT)" },
    { value: "America/Chicago", label: "Central Time (CT)" },
    { value: "America/New_York", label: "Eastern Time (ET)" },
    { value: "UTC", label: "UTC" },
];

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`,
}));

export default function NewsSettingsPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    // Preferences state
    const [newsletterActive, setNewsletterActive] = useState(false);
    const [timezone, setTimezone] = useState("America/Los_Angeles");
    const [preferredSendTimes, setPreferredSendTimes] = useState<PreferredSendTime[]>([
        { dayOfWeek: 5, hour: 9 }, // Default: Friday at 9 AM
    ]);
    const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
    const [selectedCities, setSelectedCities] = useState<UsCity[]>([]);
    const [interests, setInterests] = useState("");

    useEffect(() => {
        fetchPreferences();
    }, []);

    const fetchPreferences = async () => {
        try {
            const response = await fetch("/api/news/preferences");
            if (response.ok) {
                const data = await response.json();
                setNewsletterActive(data.newsletter_active || false);
                setTimezone(data.newsletter_timezone || "America/Los_Angeles");
                setPreferredSendTimes(data.newsletter_preferred_send_times?.length > 0 ? data.newsletter_preferred_send_times : [{ dayOfWeek: 5, hour: 9 }]);
                setInterests(data.newsletter_interests || "");

                // Location preferences are now returned directly from the API
                setSelectedCounties(data.counties || []);
                setSelectedCities(data.cities || []);
            }
        } catch (error) {
            console.error("Failed to fetch preferences:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveMessage(null);
        try {
            const response = await fetch("/api/news/preferences", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    newsletter_active: newsletterActive,
                    newsletter_timezone: timezone,
                    newsletter_preferred_send_times: preferredSendTimes,
                    newsletter_interests: interests,
                    selected_counties: selectedCounties,
                    selected_cities: selectedCities,
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to save preferences");
            }
            setSaveMessage("Preferences saved successfully!");
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (error) {
            console.error("Failed to save preferences:", error);
            setSaveMessage("Failed to save preferences. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const addSendTime = () => {
        setPreferredSendTimes([...preferredSendTimes, { dayOfWeek: 1, hour: 9 }]);
    };

    const removeSendTime = (index: number) => {
        setPreferredSendTimes(preferredSendTimes.filter((_, i) => i !== index));
    };

    const updateSendTime = (index: number, field: "dayOfWeek" | "hour", value: number) => {
        const updated = [...preferredSendTimes];
        updated[index] = { ...updated[index], [field]: value };
        setPreferredSendTimes(updated);
    };

    const handleStartFromScratch = () => {
        clearRegistrationState();
        router.push("/news/register");
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center bg-white dark:bg-gray-900">
                <Loader2 className="size-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-gray-900">
            <div className="border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="-ml-1.5 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                        <BackIcon className="h-5 w-5" />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Newsletter Preferences</h1>
                    <div className="w-9" /> {/* Spacer for centering */}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
                <div className="mx-auto max-w-2xl p-6">
                    <div className="space-y-6">
                        {/* Start from Scratch Option */}
                        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                            <div className="mb-4 flex flex-col gap-1">
                                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Reset Preferences</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Start over and go through the preference setup process again</p>
                            </div>
                            <Button variant="outline" onClick={handleStartFromScratch} className="w-full sm:w-auto">
                                <RotateCcw className="mr-2 size-4" />
                                Start from Scratch
                            </Button>
                        </div>

                        {/* Newsletter Toggle */}
                        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                            <div className="mb-6 flex flex-col gap-1">
                                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Email Newsletter</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Receive personalized CRE news digests via email</p>
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable newsletter</label>
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        className="peer sr-only"
                                        checked={newsletterActive}
                                        onChange={(e) => setNewsletterActive(e.target.checked)}
                                    />
                                    <div className="peer h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-gray-900 peer-focus:ring-4 peer-focus:ring-gray-300 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-gray-800"></div>
                                </label>
                            </div>
                        </div>

                        {/* Location Preferences */}
                        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                            <div className="mb-6 flex flex-col gap-1">
                                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Location Preferences</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Select the metro areas and counties you want to follow for CRE news</p>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Counties / Metro Areas</label>
                                    <LocationSelector
                                        selectedLocations={selectedCounties}
                                        onChange={setSelectedCounties}
                                        placeholder="Search for counties or metro areas..."
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Specific Cities (Optional)</label>
                                    <CitySelector selectedCities={selectedCities} onChange={setSelectedCities} placeholder="Search for specific cities..." />
                                </div>
                            </div>
                        </div>

                        {/* Interests */}
                        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                            <div className="mb-6 flex flex-col gap-1">
                                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Interests</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Describe your CRE interests to personalize your news feed (e.g., multifamily acquisitions, industrial development, office
                                    market trends)
                                </p>
                            </div>
                            <textarea
                                value={interests}
                                onChange={(e) => setInterests(e.target.value)}
                                placeholder="I'm interested in multifamily properties in urban areas, particularly value-add opportunities..."
                                rows={4}
                                className="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                            />
                        </div>

                        {/* Timezone */}
                        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                            <div className="mb-6 flex flex-col gap-1">
                                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Timezone</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Select your timezone for newsletter delivery times</p>
                            </div>
                            <select
                                value={timezone}
                                onChange={(e) => setTimezone(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                            >
                                {TIMEZONES.map((tz) => (
                                    <option key={tz.value} value={tz.value}>
                                        {tz.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Preferred Send Times */}
                        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                            <div className="mb-6 flex flex-col gap-1">
                                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Preferred Send Times</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Choose when you want to receive your newsletter digests</p>
                            </div>
                            <div className="space-y-3">
                                {preferredSendTimes.map((sendTime, index) => (
                                    <div key={index} className="flex items-center gap-3">
                                        <select
                                            value={sendTime.dayOfWeek}
                                            onChange={(e) => updateSendTime(index, "dayOfWeek", parseInt(e.target.value))}
                                            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                                        >
                                            {DAYS_OF_WEEK.map((day, i) => (
                                                <option key={i} value={i}>
                                                    {day}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            value={sendTime.hour}
                                            onChange={(e) => updateSendTime(index, "hour", parseInt(e.target.value))}
                                            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                                        >
                                            {HOURS.map((hour) => (
                                                <option key={hour.value} value={hour.value}>
                                                    {hour.label}
                                                </option>
                                            ))}
                                        </select>
                                        {preferredSendTimes.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeSendTime(index)}
                                                className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={addSendTime} className="mt-2">
                                    <Plus className="size-4" />
                                    Add Another Time
                                </Button>
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="flex items-center justify-between">
                            {saveMessage && (
                                <p
                                    className={`text-sm ${
                                        saveMessage.includes("success") ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                    }`}
                                >
                                    {saveMessage}
                                </p>
                            )}
                            <div className="flex-1" />
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                            >
                                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                                Save Preferences
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
