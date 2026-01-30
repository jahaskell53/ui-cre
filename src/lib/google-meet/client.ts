import { createGoogleCalendarClient, isGoogleMeetConfigured } from './config';

interface CreateMeetLinkParams {
  title: string;
  startTime: Date;
  endTime: Date;
  description?: string;
}

/**
 * Creates a Google Meet link by creating a calendar event with conferencing enabled.
 * Returns the Meet link URL or null if creation fails.
 *
 * This function is designed to fail gracefully - it will never throw.
 * If Meet link creation fails, the calling code should continue without a Meet link.
 */
export async function createMeetLink(params: CreateMeetLinkParams): Promise<string | null> {
  const { title, startTime, endTime, description } = params;

  // Check if Google Meet is configured
  if (!isGoogleMeetConfigured()) {
    console.log('Google Meet not configured - skipping Meet link creation');
    return null;
  }

  try {
    const calendar = createGoogleCalendarClient();

    if (!calendar) {
      console.log('Failed to create Google Calendar client');
      return null;
    }

    // Generate a unique request ID for conferencing
    const requestId = crypto.randomUUID();

    // Create calendar event with conferencing
    const event = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        summary: title,
        description: description || `Event created via CRE platform`,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'UTC',
        },
        conferenceData: {
          createRequest: {
            requestId,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
            accessType: 'OPEN',
          },
        },
      },
    });

    // Extract Meet link from the response
    const meetLink = event.data.conferenceData?.entryPoints?.find(
      (entry) => entry.entryPointType === 'video'
    )?.uri;

    if (!meetLink) {
      console.log('No Meet link found in calendar event response');
      return null;
    }

    console.log(`Created Google Meet link: ${meetLink}`);
    return meetLink;
  } catch (error: any) {
    // Log detailed error for debugging
    console.error('Failed to create Google Meet link:', {
      message: error?.message,
      code: error?.code,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
    });
    return null;
  }
}
