import { assertNylasConfigured, getNylasClient, nylasConfig, NYLAS_SYNC_CONFIG, getProviderScopes } from './config';
import type { Provider } from './config';

export interface NylasGrant {
  id: string;
  provider: string;
  email: string;
  grant_status: string;
  created_at: number;
  updated_at: number;
}

export interface NylasMessage {
  id: string;
  date?: number;
  subject?: string | null;
  to?: Array<{ name?: string; email: string }>;
  from?: Array<{ name?: string; email: string }>;
  cc?: Array<{ name?: string; email: string }>;
  bcc?: Array<{ name?: string; email: string }>;
  headers?: Record<string, string>;
}

export interface NylasCalendarEvent {
  id: string;
  title?: string | null;
  calendarId?: string;
  when?: {
    startTime?: number;
  };
  participants?: Array<{ name?: string; email?: string }>;
  organizer?: { name?: string; email?: string };
}

/**
 * Generate OAuth URL for email/calendar provider
 */
export function generateAuthUrl(provider: Provider, state?: string) {
  assertNylasConfigured();
  const nylasClient = getNylasClient();
  const providerScopes = getProviderScopes(provider);
  
  const config = {
    clientId: nylasConfig.clientId!,
    redirectUri: nylasConfig.redirectUri,
    provider: getProviderString(provider),
    scopes: providerScopes,
    state: state || generateRandomState(),
  };

  const url = nylasClient.auth.urlForOAuth2(config as any);
  return { url, state: config.state };
}

/**
 * Exchange authorization code for grant
 */
export async function exchangeCodeForGrant(code: string) {
  assertNylasConfigured();
  const nylasClient = getNylasClient();
  try {
    const response = await nylasClient.auth.exchangeCodeForToken({
      clientId: nylasConfig.clientId!,
      clientSecret: nylasConfig.apiKey!, // In Nylas v3, API key acts as client secret
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
  assertNylasConfigured();
  const nylasClient = getNylasClient();
  try {
    const grant = await nylasClient.grants.find({
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
  assertNylasConfigured();
  const nylasClient = getNylasClient();
  try {
    await nylasClient.grants.destroy({
      grantId,
    });
    return true;
  } catch (error) {
    console.error('Error revoking grant:', error);
    return false;
  }
}

/**
 * Collect paginated items from Nylas async iterator with retry logic
 * Adds delay between page requests to avoid rate limits
 */
async function collectPaginatedItems<T>(
  asyncList: any,
  maxItems: number
): Promise<T[]> {
  const items: T[] = [];
  let pageCount = 0;

  try {
    for await (const page of asyncList) {
      pageCount++;
      items.push(...page.data);
      console.log(`Fetched page ${pageCount}: ${page.data.length} items (total: ${items.length})`);

      if (items.length >= maxItems) break;

      // Add delay between page requests to avoid rate limits (except after last page)
      // Wait 100ms between requests to stay under rate limits
      if (page.data.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  } catch (error: any) {
    console.error('Error during pagination:', error);

    // If it's a rate limit error, log the details but return what we got
    if (error?.statusCode === 429) {
      console.log(`Rate limited after ${pageCount} pages. Returning ${items.length} items collected so far.`);
      const retryAfter = error?.headers?.['retry-after'];
      if (retryAfter) {
        console.log(`Retry-After header suggests waiting ${retryAfter} seconds`);
      }
    } else {
      // Re-throw non-rate-limit errors
      throw error;
    }
  }

  return items.slice(0, maxItems);
}

/**
 * Get messages from a grant (for contact extraction)
 * @param grantId - The Nylas grant ID
 * @param limit - Maximum number of messages to fetch
 * @param receivedAfter - Optional Unix timestamp to only fetch messages received after this time (for incremental sync)
 */
export async function getMessages(
  grantId: string,
  limit: number = NYLAS_SYNC_CONFIG.emailLimit,
  receivedAfter?: number
): Promise<NylasMessage[]> {
  assertNylasConfigured();
  const nylasClient = getNylasClient();
  try {
    // Always use limit=20 or lower to avoid rate limits (per Nylas API requirement)
    const requestLimit = Math.min(20, NYLAS_SYNC_CONFIG.maxPerRequest);
    const queryParams: Record<string, any> = {
      limit: requestLimit,
    };

    if (receivedAfter) {
      queryParams.received_after = receivedAfter;
      console.log(`Fetching up to ${limit} messages received after ${new Date(receivedAfter * 1000).toISOString()} (using limit=${requestLimit} per request)`);
    } else {
      console.log(`Fetching up to ${limit} messages (full sync, using limit=${requestLimit} per request)`);
    }

    const asyncMessages = nylasClient.messages.list({
      identifier: grantId,
      queryParams,
    });

    const allMessages = await collectPaginatedItems<NylasMessage>(asyncMessages, limit);
    console.log(`Successfully fetched ${allMessages.length} messages`);
    return allMessages;
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
}

/**
 * Get calendar events from a grant (for contact extraction)
 * @param grantId - The Nylas grant ID
 * @param limit - Maximum number of events to fetch
 * @param startAfter - Optional Unix timestamp to only fetch events starting after this time (for incremental sync)
 */
export async function getCalendarEvents(
  grantId: string,
  limit: number = NYLAS_SYNC_CONFIG.calendarLimit,
  startAfter?: number
): Promise<NylasCalendarEvent[]> {
  assertNylasConfigured();
  const nylasClient = getNylasClient();
  try {
    // Convert Unix timestamp to string for Nylas API (expects Unix timestamp as string)
    const startAfterStr = startAfter?.toString();
    
    if (startAfter) {
      console.log(`Fetching up to ${limit} calendar events starting after ${new Date(startAfter * 1000).toISOString()}`);
    } else {
      console.log(`Fetching up to ${limit} calendar events (full sync)`);
    }
    
    const calendars = await getCalendars(grantId);

    if (calendars.length === 0) {
      console.log('No calendars found');
      return [];
    }

    const eventsPerCalendar = Math.ceil(limit / calendars.length);
    const allEvents: NylasCalendarEvent[] = [];

    for (const calendar of calendars) {
      const remainingQuota = limit - allEvents.length;
      if (remainingQuota <= 0) break;

      const calendarLimit = Math.min(eventsPerCalendar, remainingQuota);

      try {
        // Always use limit=20 or lower to avoid rate limits (per Nylas API requirement)
        const requestLimit = Math.min(20, Math.min(calendarLimit, NYLAS_SYNC_CONFIG.maxPerRequest));
        const asyncEvents = nylasClient.events.list({
          identifier: grantId,
          queryParams: {
            calendarId: calendar.id,
            limit: requestLimit,
            ...(startAfterStr && { start: startAfterStr }),
          },
        });

        const calendarEvents = await collectPaginatedItems<NylasCalendarEvent>(asyncEvents, calendarLimit);
        allEvents.push(...calendarEvents);
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
  assertNylasConfigured();
  const nylasClient = getNylasClient();
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
