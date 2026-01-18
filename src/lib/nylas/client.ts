import { nylasClient, nylasConfig, NYLAS_SCOPES } from './config';
import type { Provider } from './config';

export interface NylasGrant {
  id: string;
  provider: string;
  email: string;
  grant_status: string;
  created_at: number;
  updated_at: number;
}

/**
 * Generate OAuth URL for email/calendar provider
 */
export function generateAuthUrl(provider: Provider, state?: string) {
  const config = {
    clientId: nylasConfig.clientId,
    redirectUri: nylasConfig.redirectUri,
    provider: getProviderString(provider),
    scopes: NYLAS_SCOPES,
    state: state || generateRandomState(),
  };

  const url = nylasClient.auth.urlForOAuth2(config);
  return { url, state: config.state };
}

/**
 * Exchange authorization code for grant
 */
export async function exchangeCodeForGrant(code: string) {
  try {
    const response = await nylasClient.auth.exchangeCodeForToken({
      clientId: nylasConfig.clientId,
      clientSecret: nylasConfig.apiKey, // In Nylas v3, API key acts as client secret
      redirectUri: nylasConfig.redirectUri,
      code,
    });

    return response;
  } catch (error) {
    console.error('Error exchanging code for grant:', error);
    throw error;
  }
}

/**
 * Get grant details
 */
export async function getGrant(grantId: string): Promise<NylasGrant | null> {
  try {
    const grant = await nylasClient.auth.grants.find({
      grantId,
    });

    return grant.data as unknown as NylasGrant;
  } catch (error) {
    console.error('Error fetching grant:', error);
    return null;
  }
}

/**
 * Revoke a grant (disconnect email/calendar)
 */
export async function revokeGrant(grantId: string) {
  try {
    await nylasClient.auth.grants.destroy({
      grantId,
    });
    return true;
  } catch (error) {
    console.error('Error revoking grant:', error);
    return false;
  }
}

/**
 * Get messages from a grant (for contact extraction)
 */
export async function getMessages(grantId: string, limit = 200) {
  try {
    // Nylas API limit is max 200 per request
    const actualLimit = Math.min(limit, 200);

    const messages = await nylasClient.messages.list({
      identifier: grantId,
      queryParams: {
        limit: actualLimit,
      },
    });

    return messages.data;
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
}

/**
 * Get calendar events from a grant (for contact extraction)
 */
export async function getCalendarEvents(grantId: string, limit = 200) {
  try {
    // First get all calendars
    const calendars = await getCalendars(grantId);

    if (calendars.length === 0) {
      console.log('No calendars found for grant');
      return [];
    }

    // Fetch events from each calendar
    const allEvents: any[] = [];
    const eventsPerCalendar = Math.ceil(limit / calendars.length);

    for (const calendar of calendars) {
      try {
        const events = await nylasClient.events.list({
          identifier: grantId,
          queryParams: {
            calendar_id: calendar.id,
            limit: Math.min(eventsPerCalendar, 200),
          },
        });

        allEvents.push(...events.data);

        // Stop if we've reached the limit
        if (allEvents.length >= limit) {
          break;
        }
      } catch (err) {
        console.error(`Error fetching events from calendar ${calendar.id}:`, err);
        continue;
      }
    }

    return allEvents.slice(0, limit);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return [];
  }
}

/**
 * List all calendars for a grant
 */
export async function getCalendars(grantId: string) {
  try {
    const calendars = await nylasClient.calendars.list({
      identifier: grantId,
    });

    return calendars.data;
  } catch (error) {
    console.error('Error fetching calendars:', error);
    return [];
  }
}

// Helper functions

function getProviderString(provider: Provider): string {
  const providerMap: Record<Provider, string> = {
    gmail: 'google',
    outlook: 'microsoft',
    yahoo: 'yahoo',
    icloud: 'icloud',
  };

  return providerMap[provider] || 'google';
}

function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

export { nylasClient };
