import Nylas from 'nylas';

if (!process.env.NYLAS_API_KEY) {
  throw new Error('Missing NYLAS_API_KEY environment variable');
}

if (!process.env.NYLAS_CLIENT_ID) {
  throw new Error('Missing NYLAS_CLIENT_ID environment variable');
}

// Initialize Nylas client
export const nylasClient = new Nylas({
  apiKey: process.env.NYLAS_API_KEY,
  apiUri: process.env.NYLAS_API_URI || 'https://api.us.nylas.com',
});

export const nylasConfig = {
  clientId: process.env.NYLAS_CLIENT_ID,
  redirectUri: process.env.NYLAS_REDIRECT_URI || 'http://localhost:3000/api/auth/nylas/callback',
  apiKey: process.env.NYLAS_API_KEY,
};

// Scopes needed for email and calendar access
export const NYLAS_SCOPES = [
  'email.read_only',
  'email.metadata',
  'calendar.read_only',
  'contacts.read_only',
];

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
