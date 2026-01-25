import { assertNylasConfigured, getNylasClient, nylasConfig, NYLAS_SYNC_CONFIG, getProviderScopes } from './config';
import type { Provider } from './config';

/**
 * Exponential backoff configuration
 */
const BACKOFF_CONFIG = {
  initialDelayMs: 1000,    // Start with 1 second
  maxDelayMs: 60000,       // Cap at 60 seconds
  maxRetries: 5,           // Maximum retry attempts
  backoffMultiplier: 2,    // Double the delay each retry
  jitterFactor: 0.1,       // Add 10% random jitter
};

/**
 * Check if an error is retryable (rate limit or transient server error)
 */
function isRetryableError(error: any): boolean {
  const statusCode = error?.statusCode || error?.status;
  // Retry on rate limits (429) and server errors (5xx)
  return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
}

/**
 * Extract retry delay from error headers or calculate with exponential backoff
 */
function getRetryDelay(error: any, attempt: number): number {
  // Check for Retry-After header (in seconds)
  const retryAfter = error?.headers?.['retry-after'];
  if (retryAfter) {
    const retryAfterMs = parseInt(retryAfter, 10) * 1000;
    if (!isNaN(retryAfterMs) && retryAfterMs > 0) {
      console.log(`Using Retry-After header: ${retryAfter}s`);
      return Math.min(retryAfterMs, BACKOFF_CONFIG.maxDelayMs);
    }
  }

  // Calculate exponential backoff with jitter
  const baseDelay = BACKOFF_CONFIG.initialDelayMs * Math.pow(BACKOFF_CONFIG.backoffMultiplier, attempt);
  const jitter = baseDelay * BACKOFF_CONFIG.jitterFactor * Math.random();
  return Math.min(baseDelay + jitter, BACKOFF_CONFIG.maxDelayMs);
}

/**
 * Log Nylas rate limit headers for monitoring
 */
function logRateLimitHeaders(headers: Record<string, string> | undefined, context: string) {
  if (!headers) return;

  const providerRequestCount = headers['nylas-provider-request-count'];
  const gmailQuotaUsage = headers['nylas-gmail-quota-usage'];

  if (providerRequestCount || gmailQuotaUsage) {
    console.log(`[${context}] Nylas headers - Provider requests: ${providerRequestCount || 'N/A'}, Gmail quota: ${gmailQuotaUsage || 'N/A'}`);
  }
}

/**
 * Custom error class for Nylas rate limit errors
 */
export class NylasRateLimitError extends Error {
  public readonly statusCode: number;
  public readonly retryAfterMs: number;
  public readonly headers?: Record<string, string>;
  public readonly itemsCollected: number;

  constructor(
    message: string,
    statusCode: number,
    retryAfterMs: number,
    itemsCollected: number,
    headers?: Record<string, string>
  ) {
    super(message);
    this.name = 'NylasRateLimitError';
    this.statusCode = statusCode;
    this.retryAfterMs = retryAfterMs;
    this.itemsCollected = itemsCollected;
    this.headers = headers;
  }
}

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
 * Implements exponential backoff for rate limits and transient errors
 */
async function collectPaginatedItems<T>(
  createAsyncList: () => any,
  maxItems: number,
  context: string
): Promise<T[]> {
  const items: T[] = [];
  let pageCount = 0;
  let retryCount = 0;
  let currentIterator: AsyncIterator<any> | null = null;

  while (items.length < maxItems && retryCount <= BACKOFF_CONFIG.maxRetries) {
    try {
      // Create or resume iterator
      if (!currentIterator) {
        try {
          const asyncList = createAsyncList();
          currentIterator = asyncList[Symbol.asyncIterator]();
        } catch (createError: any) {
          // If iterator creation fails, clean up and throw
          currentIterator = null;
          throw createError;
        }
      }

      // Fetch next page - wrap in a way that ensures all internal promises are handled
      let result;
      try {
        // Create a promise that will catch any rejections from the iterator
        // The Nylas SDK's iterator creates internal promises that may reject
        const nextPromise = currentIterator!.next();
        
        // Wrap it to ensure we catch all possible rejections
        result = await Promise.resolve(nextPromise).catch((err: any) => {
          // Clean up iterator on any error to prevent further rejections
          currentIterator = null;
          throw err;
        });
      } catch (iteratorError: any) {
        // If iterator.next() throws synchronously or rejects, handle it
        // Clean up iterator immediately to prevent further rejections
        currentIterator = null;
        throw iteratorError;
      }

      if (result.done) {
        break;
      }

      const page = result.value;
      pageCount++;
      items.push(...page.data);

      // Log rate limit headers for monitoring
      logRateLimitHeaders(page.headers, `${context} page ${pageCount}`);

      console.log(`[${context}] Fetched page ${pageCount}: ${page.data.length} items (total: ${items.length})`);

      if (items.length >= maxItems) break;

      // Add delay between page requests to avoid rate limits
      // Increase delay based on provider request count if available
      const providerRequests = parseInt(page.headers?.['nylas-provider-request-count'] || '0', 10);
      const baseDelay = 100;
      const adaptiveDelay = providerRequests > 10 ? baseDelay * 2 : baseDelay;

      if (page.data.length > 0) {
        await new Promise(resolve => setTimeout(resolve, adaptiveDelay));
      }

      // Reset retry count on successful page fetch
      retryCount = 0;

    } catch (error: any) {
      console.error(`[${context}] Error during pagination (attempt ${retryCount + 1}):`, error?.message || error);

      // Log rate limit headers from error if available
      logRateLimitHeaders(error?.headers, `${context} error`);

      // Clean up iterator immediately to prevent unhandled promise rejections
      // Set to null before any async operations to ensure no pending promises remain
      currentIterator = null;

      // Give a longer delay to let any pending promises from the Nylas SDK's iterator settle
      // The Nylas SDK creates internal promises that may reject asynchronously
      // This delay gives them time to reject and be caught by our error handling
      // before we continue with retry logic
      await new Promise(resolve => setTimeout(resolve, 200));

      if (isRetryableError(error) && retryCount < BACKOFF_CONFIG.maxRetries) {
        const delay = getRetryDelay(error, retryCount);
        console.log(`[${context}] Retryable error (${error?.statusCode}). Waiting ${Math.round(delay / 1000)}s before retry ${retryCount + 1}/${BACKOFF_CONFIG.maxRetries}`);

        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;

        // Continue loop to create a fresh iterator
        continue;
      }

      // Handle grant not found errors (404) - these are permanent and shouldn't be retried
      if (error?.statusCode === 404 || error?.type === 'grant.not_found' || error?.message?.includes('No Grant found')) {
        console.error(`[${context}] Grant not found (404) - this is a permanent error, not retrying`);
        const grantError = new Error(error?.message || `No Grant found for this Grant ID`);
        (grantError as any).statusCode = 404;
        (grantError as any).type = 'grant.not_found';
        throw grantError;
      }

      // Non-retryable error or max retries exceeded
      if (error?.statusCode === 429) {
        const retryAfterMs = getRetryDelay(error, retryCount);
        console.log(`[${context}] Rate limit exceeded after ${retryCount} retries. Collected ${items.length} items.`);

        // Throw a structured error that callers can handle
        throw new NylasRateLimitError(
          `Rate limited after ${pageCount} pages and ${retryCount} retries`,
          429,
          retryAfterMs,
          items.length,
          error?.headers
        );
      }

      // Re-throw other errors
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
 * @throws {NylasRateLimitError} When rate limited after max retries
 * @throws {Error} When grant is not found (404) or other non-retryable errors
 */
export async function getMessages(
  grantId: string,
  limit: number = NYLAS_SYNC_CONFIG.emailLimit,
  receivedAfter?: number
): Promise<NylasMessage[]> {
  assertNylasConfigured();
  const nylasClient = getNylasClient();

  // Validate grant exists before attempting to fetch messages
  // This prevents unhandled promise rejections from the async iterator
  try {
    const grant = await getGrant(grantId);
    if (!grant) {
      const error = new Error(`No Grant found for this Grant ID: ${grantId}`);
      (error as any).statusCode = 404;
      (error as any).type = 'grant.not_found';
      throw error;
    }
  } catch (error: any) {
    // If getGrant throws (e.g., network error), check if it's a grant not found error
    if (error?.statusCode === 404 || error?.type === 'grant.not_found') {
      const grantError = new Error(`No Grant found for this Grant ID: ${grantId}`);
      (grantError as any).statusCode = 404;
      (grantError as any).type = 'grant.not_found';
      throw grantError;
    }
    // For other errors from getGrant, log but continue - the iterator will handle it
    console.warn('Could not validate grant, proceeding with message fetch:', error?.message);
  }

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

  // Create a factory function for the async iterator
  // This allows collectPaginatedItems to recreate the iterator on retry
  const createMessageIterator = () => nylasClient.messages.list({
    identifier: grantId,
    queryParams,
  });

  try {
    const allMessages = await collectPaginatedItems<NylasMessage>(
      createMessageIterator,
      limit,
      'messages'
    );

    console.log(`Successfully fetched ${allMessages.length} messages`);
    return allMessages;
  } catch (error: any) {
    // Re-throw grant not found errors with proper structure
    if (error?.statusCode === 404 || error?.type === 'grant.not_found' || error?.message?.includes('No Grant found')) {
      const grantError = new Error(`No Grant found for this Grant ID: ${grantId}`);
      (grantError as any).statusCode = 404;
      (grantError as any).type = 'grant.not_found';
      throw grantError;
    }
    // Re-throw other errors as-is
    throw error;
  }
}

/**
 * Get calendar events from a grant (for contact extraction)
 * @param grantId - The Nylas grant ID
 * @param limit - Maximum number of events to fetch
 * @param startAfter - Optional Unix timestamp to only fetch events starting after this time (for incremental sync)
 * @throws {NylasRateLimitError} When rate limited after max retries
 */
export async function getCalendarEvents(
  grantId: string,
  limit: number = NYLAS_SYNC_CONFIG.calendarLimit,
  startAfter?: number
): Promise<NylasCalendarEvent[]> {
  assertNylasConfigured();
  const nylasClient = getNylasClient();

  // Validate grant exists before attempting to fetch calendars/events
  // This prevents unhandled promise rejections from the async iterator
  try {
    const grant = await getGrant(grantId);
    if (!grant) {
      const error = new Error(`No Grant found for this Grant ID: ${grantId}`);
      (error as any).statusCode = 404;
      (error as any).type = 'grant.not_found';
      throw error;
    }
  } catch (error: any) {
    // If getGrant throws (e.g., network error), check if it's a grant not found error
    if (error?.statusCode === 404 || error?.type === 'grant.not_found') {
      const grantError = new Error(`No Grant found for this Grant ID: ${grantId}`);
      (grantError as any).statusCode = 404;
      (grantError as any).type = 'grant.not_found';
      throw grantError;
    }
    // For other errors from getGrant, log but continue - the iterator will handle it
    console.warn('Could not validate grant, proceeding with calendar fetch:', error?.message);
  }

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

    // Always use limit=20 or lower to avoid rate limits (per Nylas API requirement)
    const requestLimit = Math.min(20, Math.min(calendarLimit, NYLAS_SYNC_CONFIG.maxPerRequest));

    // Create a factory function for the async iterator
    const createEventIterator = () => nylasClient.events.list({
      identifier: grantId,
      queryParams: {
        calendarId: calendar.id,
        limit: requestLimit,
        ...(startAfterStr && { start: startAfterStr }),
      },
    });

    try {
      const calendarEvents = await collectPaginatedItems<NylasCalendarEvent>(
        createEventIterator,
        calendarLimit,
        `calendar:${calendar.id}`
      );
      allEvents.push(...calendarEvents);
    } catch (err: any) {
      // If it's a grant not found error, propagate it up immediately
      if (err?.statusCode === 404 || err?.type === 'grant.not_found' || err?.message?.includes('No Grant found')) {
        const grantError = new Error(`No Grant found for this Grant ID: ${grantId}`);
        (grantError as any).statusCode = 404;
        (grantError as any).type = 'grant.not_found';
        throw grantError;
      }
      // If it's a rate limit error, propagate it up
      if (err instanceof NylasRateLimitError) {
        console.log(`Rate limited on calendar ${calendar.id}. Returning ${allEvents.length} events collected so far.`);
        throw err;
      }
      // Log and continue for other errors
      console.error(`Error fetching events from calendar ${calendar.id}:`, err);
      continue;
    }
  }

  return allEvents.slice(0, limit);
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
