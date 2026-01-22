"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2, Plus, Trash2, Clock, MapPin, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import LocationSelector from "@/components/news/LocationSelector";
import CitySelector from "@/components/news/CitySelector";
import { UsCity } from "@/lib/news/cities";

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

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`,
}));

export default function NewsSettingsPage() {
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
        setPreferredSendTimes(
          data.newsletter_preferred_send_times?.length > 0
            ? data.newsletter_preferred_send_times
            : [{ dayOfWeek: 5, hour: 9 }]
        );
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
      <div className="flex flex-col gap-6 p-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/news">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              Newsletter Preferences
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Customize your CRE news feed and email newsletter
            </p>
          </div>
        </div>

        {/* Newsletter Toggle */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                Email Newsletter
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Receive personalized CRE news digests via email
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={newsletterActive}
                onChange={(e) => setNewsletterActive(e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </section>

        {/* Location Preferences */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="size-5 text-gray-500" />
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              Location Preferences
            </h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Select the metro areas and counties you want to follow for CRE news
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Counties / Metro Areas
              </label>
              <LocationSelector
                selectedLocations={selectedCounties}
                onChange={setSelectedCounties}
                placeholder="Search for counties or metro areas..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Specific Cities (Optional)
              </label>
              <CitySelector
                selectedCities={selectedCities}
                onChange={setSelectedCities}
                placeholder="Search for specific cities..."
              />
            </div>
          </div>
        </section>

        {/* Interests */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
            Interests
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Describe your CRE interests to personalize your news feed (e.g., multifamily acquisitions, industrial development, office market trends)
          </p>
          <textarea
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="I'm interested in multifamily properties in urban areas, particularly value-add opportunities..."
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </section>

        {/* Timezone */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="size-5 text-gray-500" />
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              Timezone
            </h3>
          </div>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </section>

        {/* Preferred Send Times */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="size-5 text-gray-500" />
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              Preferred Send Times
            </h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Choose when you want to receive your newsletter digests
          </p>
          <div className="space-y-3">
            {preferredSendTimes.map((sendTime, index) => (
              <div key={index} className="flex items-center gap-3">
                <select
                  value={sendTime.dayOfWeek}
                  onChange={(e) => updateSendTime(index, "dayOfWeek", parseInt(e.target.value))}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
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
        </section>

        {/* Save Button */}
        <div className="flex items-center justify-between">
          {saveMessage && (
            <p
              className={`text-sm ${
                saveMessage.includes("success")
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {saveMessage}
            </p>
          )}
          <div className="flex-1" />
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save Preferences
          </Button>
        </div>
      </div>
    </div>
  );
}
