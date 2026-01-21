import { google } from 'googleapis';

// Check if Google Meet credentials are configured
export function isGoogleMeetConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
    process.env.GOOGLE_MEET_HOST_EMAIL
  );
}

// Get Google Meet configuration
export function getGoogleMeetConfig() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const hostEmail = process.env.GOOGLE_MEET_HOST_EMAIL;

  if (!serviceAccountEmail || !privateKey || !hostEmail) {
    return null;
  }

  return {
    serviceAccountEmail,
    privateKey,
    hostEmail,
  };
}

// Create and return an authenticated Google Calendar client
export function createGoogleCalendarClient() {
  const config = getGoogleMeetConfig();

  if (!config) {
    console.warn('Google Meet credentials not configured');
    return null;
  }

  try {
    // Create JWT auth client with domain-wide delegation
    const auth = new google.auth.JWT({
      email: config.serviceAccountEmail,
      key: config.privateKey,
      scopes: ['https://www.googleapis.com/auth/calendar'],
      subject: config.hostEmail, // Impersonate the host email
    });

    // Create calendar client
    const calendar = google.calendar({ version: 'v3', auth });

    return calendar;
  } catch (error) {
    console.error('Failed to create Google Calendar client:', error);
    return null;
  }
}
