// Utility for managing registration state across pages
import { UsCity } from "@/lib/news/cities";

export interface PreferredSendTime {
  dayOfWeek: number;
  hour: number;
}

export interface ConversationTurn {
  question: string;
  answer: string;
}

const STORAGE_KEY = "news_registration_state";

export interface RegistrationState {
  interests: string[];
  clarifyingQuestions: string[];
  conversation: ConversationTurn[];
  preferences: string[];
  selectedCounties: string[];
  selectedCities: UsCity[];
  firstName: string;
  timezone: string;
  preferredSendTimes: PreferredSendTime[];
}

export function getRegistrationState(): RegistrationState | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function saveRegistrationState(state: Partial<RegistrationState>): void {
  if (typeof window === "undefined") return;
  const current = getRegistrationState() || getDefaultState();
  const updated = { ...current, ...state };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function clearRegistrationState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function getDefaultState(): RegistrationState {
  return {
    interests: [""],
    clarifyingQuestions: [],
    conversation: [],
    preferences: [],
    selectedCounties: [],
    selectedCities: [],
    firstName: "",
    timezone: "",
    preferredSendTimes: [{ dayOfWeek: 5, hour: 9 }],
  };
}
