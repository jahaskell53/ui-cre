import type { NylasMessage, NylasCalendarEvent, NylasGrant } from './client';

/**
 * Mock user email - should match the email_address in the integration table for testing
 * Set MOCK_USER_EMAIL env var to override, otherwise uses the integration's email
 */
export const MOCK_USER_EMAIL = process.env.MOCK_USER_EMAIL || 'mock-user@example.com';

/**
 * Check if mock mode is enabled
 */
export function isMockMode(): boolean {
  return process.env.MOCK_NYLAS_API === 'true';
}

/**
 * Generate a mock grant for testing
 */
export function getMockGrant(grantId: string): NylasGrant {
  return {
    id: grantId,
    provider: 'google',
    email: MOCK_USER_EMAIL,
    grant_status: 'valid',
    created_at: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
    updated_at: Math.floor(Date.now() / 1000),
  };
}

/**
 * Generate mock email messages
 * Returns 2 emails with John Doe in the expected Nylas format:
 * 1. An email SENT by the user TO John Doe (creates John as a contact)
 * 2. An email RECEIVED from John Doe (tracks received interaction)
 *
 * NOTE: For mock mode to work, the integration's email_address in the database
 * must match MOCK_USER_EMAIL (or set MOCK_USER_EMAIL env var to match the integration)
 */
export function getMockMessages(userEmail: string): NylasMessage[] {
  const now = Math.floor(Date.now() / 1000);
  const twoDaysAgo = now - 172800;
  const oneDayAgo = now - 86400;

  // Use the provided userEmail or fall back to MOCK_USER_EMAIL
  const mockUserEmail = userEmail || MOCK_USER_EMAIL;

  return [
    // Email SENT by user TO John Doe (this creates John as a contact)
    {
      id: `mock-message-sent-${Date.now()}-1`,
      date: twoDaysAgo,
      subject: 'Quick question about the project',
      from: [
        {
          name: 'Mock User',
          email: mockUserEmail,
        },
      ],
      to: [
        {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
      ],
      cc: [],
      bcc: [],
      headers: {},
    },
    // Email RECEIVED from John Doe (tracks received interaction)
    {
      id: `mock-message-received-${Date.now()}-2`,
      date: oneDayAgo,
      subject: 'Re: Quick question about the project',
      from: [
        {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
      ],
      to: [
        {
          name: 'Mock User',
          email: mockUserEmail,
        },
      ],
      cc: [],
      bcc: [],
      headers: {},
    },
  ];
}

/**
 * Generate mock calendar events
 * Returns 1 calendar event with John Doe as a participant
 *
 * NOTE: For mock mode to work, the integration's email_address in the database
 * must match MOCK_USER_EMAIL (or set MOCK_USER_EMAIL env var to match the integration)
 */
export function getMockCalendarEvents(userEmail: string): NylasCalendarEvent[] {
  const now = Math.floor(Date.now() / 1000);
  const yesterday = now - 86400; // Past event so it gets processed

  // Use the provided userEmail or fall back to MOCK_USER_EMAIL
  const mockUserEmail = userEmail || MOCK_USER_EMAIL;

  return [
    {
      id: `mock-event-${Date.now()}-1`,
      title: 'Project Sync with John',
      calendarId: 'mock-calendar-1',
      when: {
        startTime: yesterday,
      },
      participants: [
        {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        {
          name: 'Mock User',
          email: mockUserEmail,
        },
      ],
      organizer: {
        name: 'John Doe',
        email: 'john.doe@example.com',
      },
    },
  ];
}

/**
 * Generate mock calendars list
 */
export function getMockCalendars() {
  return [
    {
      id: 'mock-calendar-1',
      name: 'Primary Calendar',
      description: 'Mock primary calendar',
      isPrimary: true,
    },
  ];
}

// Log mock mode status on module load
if (isMockMode()) {
  console.log('[Nylas Mock] ✅ Mock mode ENABLED');
  console.log(`[Nylas Mock] Mock user email: ${MOCK_USER_EMAIL}`);
  console.log('[Nylas Mock] To use: ensure your integration\'s email_address matches MOCK_USER_EMAIL');
  console.log('[Nylas Mock] Mock data includes: 1 sent email, 1 received email, 1 calendar event with John Doe');
}
