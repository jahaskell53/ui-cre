import { getMessages, getCalendarEvents } from './client';
import { createAdminClient } from '@/utils/supabase/admin';

interface Contact {
  email_address: string;
  first_name?: string;
  last_name?: string;
  first_interaction_at?: string;
  last_interaction_at?: string;
  interaction_count?: number;
  source?: string;
}

/**
 * Parse email address and extract name components
 */
function parseEmailAddress(emailString: string): {
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
} {
  // Handle formats like: "John Doe <john@example.com>" or "john@example.com"
  const match = emailString.match(/(.*?)\s*<(.+?)>/) || emailString.match(/(.+)/);

  if (!match) {
    return { email: emailString };
  }

  const email = match[2] || match[1];
  const name = match[1]?.trim();

  if (!name || name === email) {
    return { email: email.trim() };
  }

  // Split name into first and last
  const nameParts = name.split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');

  return {
    email: email.trim(),
    name,
    firstName,
    lastName: lastName || undefined,
  };
}

/**
 * Sync contacts from email messages
 */
export async function syncEmailContacts(grantId: string, userId: string) {
  try {
    console.log(`Starting email sync for grant ${grantId}`);

    const messages = await getMessages(grantId, 200);
    const contactsMap = new Map<string, Contact>();

    for (const message of messages) {
      const date = message.date ? new Date(message.date * 1000).toISOString() : new Date().toISOString();

      // Extract from address
      if (message.from && message.from.length > 0) {
        const from = message.from[0];
        const parsed = parseEmailAddress(`${from.name || ''} <${from.email}>`);

        if (parsed.email && !parsed.email.includes('noreply')) {
          const existing = contactsMap.get(parsed.email);

          contactsMap.set(parsed.email, {
            email_address: parsed.email,
            first_name: parsed.firstName || existing?.first_name,
            last_name: parsed.lastName || existing?.last_name,
            first_interaction_at: existing?.first_interaction_at
              ? (new Date(existing.first_interaction_at) < new Date(date) ? existing.first_interaction_at : date)
              : date,
            last_interaction_at: existing?.last_interaction_at
              ? (new Date(existing.last_interaction_at) > new Date(date) ? existing.last_interaction_at : date)
              : date,
            interaction_count: (existing?.interaction_count || 0) + 1,
            source: 'email',
          });
        }
      }

      // Extract to addresses
      if (message.to && message.to.length > 0) {
        for (const to of message.to) {
          const parsed = parseEmailAddress(`${to.name || ''} <${to.email}>`);

          if (parsed.email && !parsed.email.includes('noreply')) {
            const existing = contactsMap.get(parsed.email);

            contactsMap.set(parsed.email, {
              email_address: parsed.email,
              first_name: parsed.firstName || existing?.first_name,
              last_name: parsed.lastName || existing?.last_name,
              first_interaction_at: existing?.first_interaction_at
                ? (new Date(existing.first_interaction_at) < new Date(date) ? existing.first_interaction_at : date)
                : date,
              last_interaction_at: existing?.last_interaction_at
                ? (new Date(existing.last_interaction_at) > new Date(date) ? existing.last_interaction_at : date)
                : date,
              interaction_count: (existing?.interaction_count || 0) + 1,
              source: 'email',
            });
          }
        }
      }
    }

    // Store contacts in database
    const supabase = createAdminClient();
    const contacts = Array.from(contactsMap.values());

    for (const contact of contacts) {
      // Try to upsert to people table - insert if new, update if exists
      const { data: existing } = await supabase
        .from('people')
        .select('id')
        .eq('user_id', userId)
        .eq('email', contact.email_address)
        .single();

      if (existing) {
        // Update existing person
        await supabase
          .from('people')
          .update({
            name: contact.first_name && contact.last_name
              ? `${contact.first_name} ${contact.last_name}`
              : contact.first_name || contact.email_address,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        // Insert new person
        await supabase
          .from('people')
          .insert({
            user_id: userId,
            name: contact.first_name && contact.last_name
              ? `${contact.first_name} ${contact.last_name}`
              : contact.first_name || contact.email_address,
            email: contact.email_address,
            starred: false,
            signal: false,
          });
      }
    }

    console.log(`Email sync complete: ${contacts.length} contacts processed`);
    return contacts.length;
  } catch (error) {
    console.error('Error syncing email contacts:', error);
    throw error;
  }
}

/**
 * Sync contacts from calendar events
 */
export async function syncCalendarContacts(grantId: string, userId: string) {
  try {
    console.log(`Starting calendar sync for grant ${grantId}`);

    const events = await getCalendarEvents(grantId, 200);
    const contactsMap = new Map<string, Contact>();

    for (const event of events) {
      const date = event.when?.startTime
        ? new Date(event.when.startTime * 1000).toISOString()
        : new Date().toISOString();

      // Extract participants
      if (event.participants && event.participants.length > 0) {
        for (const participant of event.participants) {
          if (!participant.email || participant.email.includes('noreply')) {
            continue;
          }

          const parsed = parseEmailAddress(`${participant.name || ''} <${participant.email}>`);
          const existing = contactsMap.get(parsed.email);

          contactsMap.set(parsed.email, {
            email_address: parsed.email,
            first_name: parsed.firstName || existing?.first_name,
            last_name: parsed.lastName || existing?.last_name,
            first_interaction_at: existing?.first_interaction_at
              ? (new Date(existing.first_interaction_at) < new Date(date) ? existing.first_interaction_at : date)
              : date,
            last_interaction_at: existing?.last_interaction_at
              ? (new Date(existing.last_interaction_at) > new Date(date) ? existing.last_interaction_at : date)
              : date,
            interaction_count: (existing?.interaction_count || 0) + 1,
            source: existing?.source === 'email' ? 'email' : 'calendar',
          });
        }
      }

      // Extract organizer
      if (event.organizer?.email && !event.organizer.email.includes('noreply')) {
        const parsed = parseEmailAddress(`${event.organizer.name || ''} <${event.organizer.email}>`);
        const existing = contactsMap.get(parsed.email);

        contactsMap.set(parsed.email, {
          email_address: parsed.email,
          first_name: parsed.firstName || existing?.first_name,
          last_name: parsed.lastName || existing?.last_name,
          first_interaction_at: existing?.first_interaction_at
            ? (new Date(existing.first_interaction_at) < new Date(date) ? existing.first_interaction_at : date)
            : date,
          last_interaction_at: existing?.last_interaction_at
            ? (new Date(existing.last_interaction_at) > new Date(date) ? existing.last_interaction_at : date)
            : date,
          interaction_count: (existing?.interaction_count || 0) + 1,
          source: existing?.source === 'email' ? 'email' : 'calendar',
        });
      }
    }

    // Store contacts in database
    const supabase = createAdminClient();
    const contacts = Array.from(contactsMap.values());

    for (const contact of contacts) {
      // Try to upsert to people table - insert if new, update if exists
      const { data: existing } = await supabase
        .from('people')
        .select('id')
        .eq('user_id', userId)
        .eq('email', contact.email_address)
        .single();

      if (existing) {
        // Update existing person
        await supabase
          .from('people')
          .update({
            name: contact.first_name && contact.last_name
              ? `${contact.first_name} ${contact.last_name}`
              : contact.first_name || contact.email_address,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        // Insert new person
        await supabase
          .from('people')
          .insert({
            user_id: userId,
            name: contact.first_name && contact.last_name
              ? `${contact.first_name} ${contact.last_name}`
              : contact.first_name || contact.email_address,
            email: contact.email_address,
            starred: false,
            signal: false,
          });
      }
    }

    console.log(`Calendar sync complete: ${contacts.length} contacts processed`);
    return contacts.length;
  } catch (error) {
    console.error('Error syncing calendar contacts:', error);
    throw error;
  }
}

/**
 * Sync all contacts from both email and calendar
 */
export async function syncAllContacts(grantId: string, userId: string) {
  try {
    const [emailCount, calendarCount] = await Promise.all([
      syncEmailContacts(grantId, userId),
      syncCalendarContacts(grantId, userId),
    ]);

    // Update integration sync status
    const supabase = createAdminClient();
    await supabase
      .from('integrations')
      .update({
        last_sync_at: new Date().toISOString(),
        first_sync_at: new Date().toISOString(),
        status: 'active',
      })
      .eq('nylas_grant_id', grantId);

    return { emailCount, calendarCount };
  } catch (error) {
    console.error('Error syncing all contacts:', error);

    // Update integration with error status
    const supabase = createAdminClient();
    await supabase
      .from('integrations')
      .update({
        status: 'error',
        sync_error: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('nylas_grant_id', grantId);

    throw error;
  }
}
