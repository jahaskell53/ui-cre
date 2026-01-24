"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LocationSelector from "@/components/news/LocationSelector";
import CitySelector from "@/components/news/CitySelector";
import { UsCity } from "@/lib/news/cities";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { getRegistrationState, saveRegistrationState, PreferredSendTime, clearRegistrationState } from "@/lib/news/registration-state";
import RegisterNavBar from "@/components/news/register-nav-bar";

// Helper function to detect user's timezone
function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export default function CompletePage() {
  const router = useRouter();
  const { user, profile } = useUser();
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<UsCity[]>([]);
  const [firstName, setFirstName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [preferredSendTimes, setPreferredSendTimes] = useState<PreferredSendTime[]>([{ dayOfWeek: 5, hour: 9 }]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const state = getRegistrationState();
    if (!state || !state.preferences || state.preferences.length === 0) {
      router.push("/news/register/review");
      return;
    }

    setSelectedCounties(state.selectedCounties || []);
    setSelectedCities(state.selectedCities || []);
    setFirstName(state.firstName || profile?.full_name || "");
    setTimezone(state.timezone || detectTimezone());
    setPreferredSendTimes(state.preferredSendTimes.length > 0 ? state.preferredSendTimes : [{ dayOfWeek: 5, hour: 9 }]);
  }, [profile, router]);

  const handleLocationChange = (locations: string[]) => {
    setSelectedCounties(locations);
    saveRegistrationState({ selectedCounties: locations });
  };

  const handleCitiesChange = (cities: UsCity[]) => {
    setSelectedCities(cities);
    saveRegistrationState({ selectedCities: cities });
  };

  const addPreferredSendTime = () => {
    const newTimes = [...preferredSendTimes, { dayOfWeek: 5, hour: 9 }];
    setPreferredSendTimes(newTimes);
    saveRegistrationState({ preferredSendTimes: newTimes });
  };

  const updatePreferredSendTime = (index: number, field: "dayOfWeek" | "hour", value: number) => {
    const updated = [...preferredSendTimes];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setPreferredSendTimes(updated);
    saveRegistrationState({ preferredSendTimes: updated });
  };

  const removePreferredSendTime = (index: number) => {
    const newTimes = preferredSendTimes.filter((_, i) => i !== index);
    setPreferredSendTimes(newTimes);
    saveRegistrationState({ preferredSendTimes: newTimes });
  };

  const handleFinalRegistration = async (e: React.FormEvent) => {
    e.preventDefault();

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

    const state = getRegistrationState();
    if (!state) {
      setError("Registration data not found. Please start over.");
      setIsLoading(false);
      return;
    }

    const finalInterests = state.preferences.length > 0
      ? JSON.stringify(state.preferences)
      : state.interests.filter(i => i.trim() !== "").join(", ");

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
            router.push("/news/register/confirmation");
          } else {
            const errorData = await subscribeResponse.json();
            setError(errorData.error || "Newsletter sent but subscription failed. Please try again.");
            setIsLoading(false);
          }
        } catch {
          setError("Newsletter sent but subscription failed. Please try again.");
          setIsLoading(false);
        }
      } else {
        setError(data.error || "Failed to send newsletter");
        setIsLoading(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-white dark:bg-gray-900">
      <RegisterNavBar title="Complete Registration" />

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
        <div className="px-2 sm:px-4 max-w-4xl mx-auto w-full py-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm p-6 mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Complete your registration
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              Just a few more details to get you started with your personalized newsletter.
            </p>
          </div>

          <form onSubmit={handleFinalRegistration} className="space-y-6">
            {/* Regions Section */}
            <div>
              <label className="block text-base font-medium text-gray-900 dark:text-gray-100 mb-3">
                Selected Regions {selectedCounties.length > 0 && `(${selectedCounties.length})`}
              </label>
              {selectedCounties.length > 0 && (
                <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    ✓ We automatically selected {selectedCounties.length} region{selectedCounties.length !== 1 ? 's' : ''} based on your interests. You can adjust the selection below if needed.
                  </p>
                </div>
              )}
              <LocationSelector
                selectedLocations={selectedCounties}
                onChange={handleLocationChange}
                placeholder="Search or select regions..."
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {selectedCounties.length === 0
                  ? "Leave empty to include all regions, or select specific regions to focus on"
                  : "Adjust the selection above or leave as-is to continue"
                }
              </p>
            </div>

            {/* Cities Section */}
            <div>
              <label className="block text-base font-medium text-gray-900 dark:text-gray-100 mb-3">
                Selected Cities {selectedCities.length > 0 && `(${selectedCities.length})`}
              </label>
              <CitySelector
                selectedCities={selectedCities}
                onChange={handleCitiesChange}
                placeholder="Search or select cities..."
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Select specific cities to narrow down your news feed further.
              </p>
            </div>

            {/* Name Input */}
            <div>
              <label className="block text-base font-medium text-gray-900 dark:text-gray-100 mb-2">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  saveRegistrationState({ firstName: e.target.value });
                }}
                placeholder="John Doe"
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Timezone Selection */}
            <div>
              <label className="block text-base font-medium text-gray-900 dark:text-gray-100 mb-2">
                What timezone should we use to send your newsletter?
              </label>
              <select
                value={timezone}
                onChange={(e) => {
                  setTimezone(e.target.value);
                  saveRegistrationState({ timezone: e.target.value });
                }}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label className="block text-base font-medium text-gray-900 dark:text-gray-100 mb-2">
                When should we send your newsletters? (Select one or more times)
              </label>
              <div className="space-y-2">
                {preferredSendTimes.map((time, index) => (
                  <div key={`${time.dayOfWeek}-${time.hour}-${index}`} className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                    <select
                      value={time.dayOfWeek}
                      onChange={(e) => updatePreferredSendTime(index, "dayOfWeek", parseInt(e.target.value, 10))}
                      className="flex-1 sm:w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                      className="flex-1 sm:w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                      className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
                className="mt-3 px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600"
              >
                + Add another send time
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                We&apos;ll send your newsletter at these times in your chosen timezone.
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/news/register/review")}
              >
                <BackIcon className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                type="submit"
                disabled={
                  isLoading ||
                  !firstName.trim() ||
                  !timezone.trim() ||
                  preferredSendTimes.length === 0
                }
                className="bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
              >
                {isLoading ? "Sending Newsletter..." : "Register and Test Newsletter"}
              </Button>
            </div>
          </form>

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
