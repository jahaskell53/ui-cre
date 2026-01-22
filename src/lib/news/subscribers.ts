import { createClient } from "@/utils/supabase/server";
import { UsCity } from "./cities";

// Helper function to validate timezone string
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export interface PreferredSendTime {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  hour: number; // 0-23 (24-hour format)
}

export const DEFAULT_PREFERRED_SEND_TIMES: PreferredSendTime[] = [
  { dayOfWeek: 5, hour: 9 },
];

export interface Subscriber {
  id: string;
  firstName: string;
  email: string;
  selectedCounties: string[];
  selectedCities: UsCity[];
  subscribedAt: string | null;
  isActive: boolean;
  interests?: string;
  otherLocation?: string;
  timezone?: string;
  preferredSendTimes: PreferredSendTime[];
}

export async function getActiveSubscribers(): Promise<Subscriber[]> {
  try {
    const supabase = await createClient();

    const { data: subscribers, error } = await supabase
      .from("subscribers")
      .select(`
        id,
        email,
        full_name,
        subscribed_at,
        is_active,
        interests,
        timezone,
        preferred_send_times,
        subscriber_counties (
          county_id,
          counties (name)
        ),
        subscriber_cities (
          city_id,
          cities (name, state, state_abbr)
        )
      `)
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching active subscribers:", error);
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (subscribers || []).map((s: any) => mapToSubscriberInterface(s));
  } catch (error) {
    console.error("Error getting active subscribers:", error);
    return [];
  }
}

export async function getSubscriberByEmail(email: string): Promise<Subscriber | null> {
  try {
    const supabase = await createClient();

    const { data: subscriber, error } = await supabase
      .from("subscribers")
      .select(`
        id,
        email,
        full_name,
        subscribed_at,
        is_active,
        interests,
        timezone,
        preferred_send_times,
        subscriber_counties (
          county_id,
          counties (name)
        ),
        subscriber_cities (
          city_id,
          cities (name, state, state_abbr)
        )
      `)
      .eq("email", email.toLowerCase())
      .single();

    if (error || !subscriber) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return mapToSubscriberInterface(subscriber as any);
  } catch (error) {
    console.error("Error getting subscriber by email:", error);
    return null;
  }
}

export async function unsubscribe(email: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("subscribers")
      .update({ is_active: false })
      .eq("email", email.toLowerCase());

    if (error) {
      console.error("Error unsubscribing:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error unsubscribing:", error);
    return false;
  }
}

function extractPreferredSendTimes(raw: unknown): PreferredSendTime[] {
  const fallback = [...DEFAULT_PREFERRED_SEND_TIMES];

  const tryNormalize = (value: unknown): PreferredSendTime[] | null => {
    if (!Array.isArray(value)) {
      return null;
    }

    const normalized = value
      .map((entry) => ({
        dayOfWeek: Number((entry as { dayOfWeek?: unknown }).dayOfWeek),
        hour: Number((entry as { hour?: unknown }).hour),
      }))
      .filter(
        (entry) =>
          !Number.isNaN(entry.dayOfWeek) &&
          !Number.isNaN(entry.hour) &&
          entry.dayOfWeek >= 0 &&
          entry.dayOfWeek <= 6 &&
          entry.hour >= 0 &&
          entry.hour <= 23
      );

    return normalized.length > 0 ? normalized : null;
  };

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      const normalized = tryNormalize(parsed);
      if (normalized) {
        return normalized;
      }
    } catch {
      // Parsing failed
    }
  } else if (Array.isArray(raw)) {
    const normalized = tryNormalize(raw);
    if (normalized) {
      return normalized;
    }
  } else if (raw && typeof raw === 'object') {
    try {
      const cloned = JSON.parse(JSON.stringify(raw));
      const normalized = tryNormalize(cloned);
      if (normalized) {
        return normalized;
      }
    } catch {
      // Processing failed
    }
  }

  return fallback;
}

// Helper function to map Supabase data to Subscriber interface
function mapToSubscriberInterface(dbSubscriber: {
  id: string;
  email: string;
  full_name: string;
  subscribed_at: string | null;
  is_active: boolean | null;
  interests: string | null;
  timezone: string | null;
  preferred_send_times: unknown;
  subscriber_counties: Array<{ county_id: string; counties: { name: string } | null }>;
  subscriber_cities: Array<{ city_id: string; cities: { name: string; state: string; state_abbr: string } | null }>;
}): Subscriber {
  return {
    id: dbSubscriber.id,
    firstName: dbSubscriber.full_name,
    email: dbSubscriber.email,
    selectedCounties: dbSubscriber.subscriber_counties
      .map(c => c.counties?.name)
      .filter((c): c is string => c !== null && c !== undefined),
    selectedCities: dbSubscriber.subscriber_cities
      .filter(c => c.cities !== null)
      .map(c => ({
        name: c.cities!.name,
        state: c.cities!.state,
        stateAbbr: c.cities!.state_abbr,
        zip: "",
        county: "",
        countCode: "",
        latitude: 0,
        longitude: 0
      })),
    subscribedAt: dbSubscriber.subscribed_at,
    isActive: dbSubscriber.is_active ?? true,
    interests: dbSubscriber.interests || undefined,
    timezone: dbSubscriber.timezone || undefined,
    preferredSendTimes: extractPreferredSendTimes(dbSubscriber.preferred_send_times)
  };
}
