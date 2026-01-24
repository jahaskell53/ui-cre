import Nylas from 'nylas';

let cachedNylasClient: Nylas | null = null;

export function assertNylasConfigured() {
  if (!process.env.NYLAS_API_KEY) {
    throw new Error('Missing NYLAS_API_KEY environment variable');
  }

  if (!process.env.NYLAS_CLIENT_ID) {
    throw new Error('Missing NYLAS_CLIENT_ID environment variable');
  }
}

export function getNylasClient(): Nylas {
  if (cachedNylasClient) return cachedNylasClient;

  if (!process.env.NYLAS_API_KEY) {
    throw new Error('Missing NYLAS_API_KEY environment variable');
  }

  cachedNylasClient = new Nylas({
    apiKey: process.env.NYLAS_API_KEY,
    apiUri: process.env.NYLAS_API_URI || 'https://api.us.nylas.com',
  });

  return cachedNylasClient;
}

export const nylasConfig = {
  clientId: process.env.NYLAS_CLIENT_ID,
  redirectUri: process.env.NYLAS_REDIRECT_URI || 'http://localhost:3000/api/auth/nylas/callback',
  apiKey: process.env.NYLAS_API_KEY,
};

// Provider-specific scopes for Nylas v3 (read-only, no send permissions)
// These are the correct v3 scopes that won't trigger "send email" permissions
export function getProviderScopes(provider: Provider): string[] {
  switch (provider) {
    case 'gmail':
      return [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/contacts.readonly',
      ];
    case 'outlook':
      return [
        'https://graph.microsoft.com/Mail.Read',
        'https://graph.microsoft.com/Calendars.Read',
        'https://graph.microsoft.com/Contacts.Read',
      ];
    case 'yahoo':
    case 'icloud':
      // Yahoo and iCloud may use different scope formats or Nylas may handle them differently
      // Using generic format - Nylas SDK may translate these
      return [
        'email.read_only',
        'calendar.read_only',
        'contacts.read_only',
      ];
    default:
      return [
        'email.read_only',
        'calendar.read_only',
        'contacts.read_only',
      ];
  }
}

// Sync configuration
const emailLimit = parseInt(process.env.NYLAS_EMAIL_SYNC_LIMIT || '600', 10);
const calendarLimit = parseInt(process.env.NYLAS_CALENDAR_SYNC_LIMIT || '600', 10);

export const NYLAS_SYNC_CONFIG = {
  emailLimit: Math.max(emailLimit, 1),
  calendarLimit: Math.max(calendarLimit, 1),
  maxPerRequest: 20, // Nylas API: use limit=20 or lower to avoid rate limit errors
} as const;

export const PROVIDER_CONFIG = {
  gmail: {
    name: 'Gmail',
    provider: 'google',
    icon: '📧',
    color: '#EA4335',
  },
  outlook: {
    name: 'Outlook',
    provider: 'microsoft',
    icon: '📨',
    color: '#0078D4',
  },
  yahoo: {
    name: 'Yahoo',
    provider: 'yahoo',
    icon: '📮',
    color: '#6001D2',
  },
  icloud: {
    name: 'iCloud',
    provider: 'icloud',
    icon: '☁️',
    color: '#3693F3',
  },
} as const;

export type Provider = keyof typeof PROVIDER_CONFIG;
