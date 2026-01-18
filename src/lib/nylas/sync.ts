import { getMessages, getCalendarEvents, type NylasMessage, type NylasCalendarEvent } from './client';
import { NYLAS_SYNC_CONFIG } from './config';
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

interface EmailInteraction {
  email: string;
  subject: string | null;
  occurred_at: string;
  type: 'email_sent' | 'email_received';
  message_id: string;
}

interface CalendarInteraction {
  email: string;
  subject: string | null;
  occurred_at: string;
  event_id: string;
  calendar_id: string;
}

/**
 * Check if an email is likely automated/mass email vs human email
 */
function isAutomatedEmail(email: string, message?: NylasMessage, name?: string): boolean {
  const emailLower = email.toLowerCase();
  const nameLower = name?.toLowerCase() || '';
  
  // Check display name for "Do Not Reply" and similar patterns
  const namePatterns = [
    'do not reply', 'don\'t reply', 'do not respond',
    'don\'t respond', 'no reply', 'no response',
    'automated', 'automatic', 'system', 'notification',
    'mailer', 'unsubscribe',
  ];
  
  if (nameLower && namePatterns.some(pattern => nameLower.includes(pattern))) {
    return true;
  }
  
  // Common automated email patterns
  const automatedPatterns = [
    'noreply', 'no-reply', 'donotreply', 'do-not-reply',
    'no_reply', 'donotreply', 'automated', 'automatic',
    'mailer', 'mailer-daemon', 'postmaster', 'daemon',
    'notification', 'notifications', 'alerts', 'alert',
    'system', 'systems', 'service', 'services',
    'bounce', 'bounces', 'unsubscribe', 'unsub',
  ];
  
  // Check if email contains automated patterns
  if (automatedPatterns.some(pattern => emailLower.includes(pattern))) {
    return true;
  }
  
  // Role-based email addresses (common for automated/mass emails)
  const roleBasedPrefixes = [
    'info@', 'support@', 'sales@', 'marketing@', 'newsletter@',
    'news@', 'updates@', 'updates@', 'team@', 'hello@',
    'contact@', 'help@', 'admin@', 'administrator@',
    'webmaster@', 'abuse@', 'security@', 'privacy@',
  ];
  
  if (roleBasedPrefixes.some(prefix => emailLower.startsWith(prefix))) {
    return true;
  }
  
  // Check email headers if available (Nylas may provide these)
  if (message?.headers) {
    const headers = message.headers;
    
    // Check for List-Unsubscribe header (indicates marketing/newsletter)
    if (headers['list-unsubscribe'] || headers['List-Unsubscribe']) {
      return true;
    }
    
    // Check for bulk email indicators
    if (headers['precedence']?.toLowerCase() === 'bulk' ||
        headers['Precedence']?.toLowerCase() === 'bulk') {
      return true;
    }
    
    // Check for auto-submitted header
    if (headers['auto-submitted'] || headers['Auto-Submitted']) {
      const autoSubmitted = (headers['auto-submitted'] || headers['Auto-Submitted']).toLowerCase();
      if (autoSubmitted !== 'no') {
        return true;
      }
    }
    
    // Check for X-Auto-Response header
    if (headers['x-auto-response'] || headers['X-Auto-Response']) {
      return true;
    }
  }
  
  // Check for common disposable email domains
  const disposableDomains = [
    'mailinator.com', 'guerrillamail.com', '10minutemail.com',
    'tempmail.com', 'throwaway.email', 'getnada.com',
  ];
  
  const domain = emailLower.split('@')[1];
  if (domain && disposableDomains.some(d => domain.includes(d))) {
    return true;
  }
  
  // Exclude Apple Private Relay and Fastmail aliases (privacy/alias domains)
  if (domain && (domain.endsWith('privaterelay.appleid.com') || domain.endsWith('fastmail.com'))) {
    return true;
  }
  
  // Check for common newsletter/marketing platform domains
  const newsletterDomains = [
    'substack.com', 'mailchimp.com', 'constantcontact.com',
    'campaignmonitor.com', 'sendgrid.com', 'mailgun.com',
    'sendinblue.com', 'getresponse.com', 'aweber.com',
    'convertkit.com', 'drip.com', 'activecampaign.com',
    'hubspot.com', 'marketo.com', 'pardot.com',
    'mailjet.com', 'sparkpost.com', 'postmarkapp.com',
    'mandrill.com', 'pepipost.com', 'postal.io',
  ];
  
  if (domain && newsletterDomains.some(d => domain.includes(d))) {
    return true;
  }
  
  return false;
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

    const messages = await getMessages(grantId, NYLAS_SYNC_CONFIG.emailLimit);
    console.log(`Fetched ${messages.length} messages from Nylas`);

    const contactsMap = new Map<string, Contact>();
    const emailInteractions: EmailInteraction[] = [];

    // Get integration ID for tracking
    const supabase = createAdminClient();
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('nylas_grant_id', grantId)
      .single();

    const integrationId = integration?.id;

    // First pass: Identify contacts we've emailed (from "to" addresses)
    // This determines which contacts to include
    const contactsWeveEmailed = new Set<string>();
    
    for (const message of messages) {
      const date = message.date ? new Date(message.date * 1000).toISOString() : new Date().toISOString();
      const subject = message.subject || null;

      // Extract to addresses (email sent) - these are contacts we've emailed
      if (message.to && message.to.length > 0) {
        for (const to of message.to) {
          const parsed = parseEmailAddress(`${to.name || ''} <${to.email}>`);

          if (parsed.email && !isAutomatedEmail(parsed.email, message, parsed.name)) {
            contactsWeveEmailed.add(parsed.email.toLowerCase());
          }
        }
      }
    }

    // Second pass: Process all messages and track interactions for contacts we've emailed
    for (const message of messages) {
      const date = message.date ? new Date(message.date * 1000).toISOString() : new Date().toISOString();
      const subject = message.subject || null;

      // Process "to" addresses (emails sent) - only for contacts we've emailed
      if (message.to && message.to.length > 0) {
        for (const to of message.to) {
          const parsed = parseEmailAddress(`${to.name || ''} <${to.email}>`);

          if (parsed.email && !isAutomatedEmail(parsed.email, message, parsed.name)) {
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

            // Track email sent interaction
            emailInteractions.push({
              email: parsed.email,
              subject,
              occurred_at: date,
              type: 'email_sent',
              message_id: message.id,
            });
          }
        }
      }

      // Process "from" addresses (emails received) - only for contacts we've emailed
      if (message.from && message.from.length > 0) {
        const from = message.from[0];
        const parsed = parseEmailAddress(`${from.name || ''} <${from.email}>`);

        // Only process if we've emailed this contact at least once
        if (parsed.email && 
            !isAutomatedEmail(parsed.email, message, parsed.name) &&
            contactsWeveEmailed.has(parsed.email.toLowerCase())) {
          
          const existing = contactsMap.get(parsed.email);

          // Update contact info if we have better name info from received email
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

          // Track email received interaction
          emailInteractions.push({
            email: parsed.email,
            subject,
            occurred_at: date,
            type: 'email_received',
            message_id: message.id,
          });
        }
      }
    }

    // Store contacts in database and get their IDs
    const contacts = Array.from(contactsMap.values());
    console.log(`Extracted ${contacts.length} unique contacts from emails`);

    const emailToPerson = new Map<string, string>(); // email -> person_id

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

        emailToPerson.set(contact.email_address, existing.id);
      } else {
        // Insert new person
        const { data: newPerson } = await supabase
          .from('people')
          .insert({
            user_id: userId,
            name: contact.first_name && contact.last_name
              ? `${contact.first_name} ${contact.last_name}`
              : contact.first_name || contact.email_address,
            email: contact.email_address,
            starred: false,
            signal: false,
          })
          .select('id')
          .single();

        if (newPerson) {
          emailToPerson.set(contact.email_address, newPerson.id);
        }
      }
    }

    // Batch insert interactions - PostgreSQL unique index will skip duplicates
    console.log(`Batch inserting ${emailInteractions.length} interaction records`);

    // Prepare all interactions for batch insert
    const interactionsToInsert = emailInteractions
      .filter(interaction => emailToPerson.has(interaction.email))
      .map(interaction => ({
        user_id: userId,
        person_id: emailToPerson.get(interaction.email),
        integration_id: integrationId,
        interaction_type: interaction.type,
        subject: interaction.subject,
        occurred_at: interaction.occurred_at,
        metadata: { message_id: interaction.message_id },
      }));

    let interactionCount = 0;

    if (interactionsToInsert.length > 0) {
      // Batch insert using upsert with ignoreDuplicates
      // The unique index on (user_id, person_id, metadata->>'message_id') handles duplicates
      const { data: insertedInteractions, error } = await supabase
        .from('interactions')
        .upsert(interactionsToInsert, {
          onConflict: 'user_id,person_id,metadata->>message_id',
          ignoreDuplicates: true
        })
        .select('id');

      if (error) {
        // If upsert fails, fall back to insert (duplicates will be ignored by DB constraint)
        console.log('Upsert not supported, using insert with ignore duplicates behavior');
        const { error: insertError } = await supabase
          .from('interactions')
          .insert(interactionsToInsert);

        if (insertError && !insertError.message.includes('duplicate')) {
          console.error('Error batch inserting interactions:', insertError);
        }
        interactionCount = interactionsToInsert.length;
      } else {
        interactionCount = insertedInteractions?.length || interactionsToInsert.length;
      }
    }

    // Batch timeline updates
    // Group interactions by person for timeline updates
    const interactionsByPerson = new Map<string, typeof emailInteractions>();
    for (const interaction of emailInteractions) {
      const personId = emailToPerson.get(interaction.email);
      if (!personId) continue;

      if (!interactionsByPerson.has(personId)) {
        interactionsByPerson.set(personId, []);
      }
      interactionsByPerson.get(personId)!.push(interaction);
    }

    // Fetch all people at once
    const personIds = Array.from(interactionsByPerson.keys());
    if (personIds.length > 0) {
      const { data: people } = await supabase
        .from('people')
        .select('id, timeline, name')
        .in('id', personIds);

      // Batch update timelines using Promise.all
      if (people && people.length > 0) {
        const timelineUpdates = people.map(person => {
          const interactions = interactionsByPerson.get(person.id) || [];
          const newEntries = interactions.map(interaction => ({
            type: 'email' as const,
            text: interaction.type === 'email_sent'
              ? `You emailed ${person.name.split(' ')[0]} ${interaction.subject || '(no subject)'}`
              : `${person.name.split(' ')[0]} emailed you ${interaction.subject || '(no subject)'}`,
            date: new Date(interaction.occurred_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric'
            }),
            iconColor: 'purple' as const,
            link: interaction.subject || undefined,
          }));

          return {
            id: person.id,
            timeline: [...newEntries, ...(person.timeline || [])],
          };
        });

        console.log(`Batch updating timelines for ${timelineUpdates.length} people`);
        await Promise.all(
          timelineUpdates.map(update =>
            supabase.from('people').update({ timeline: update.timeline }).eq('id', update.id)
          )
        );
      }
    }

    console.log(`Email sync complete: ${contacts.length} contacts processed, ${interactionCount} interactions batch inserted`);
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

    const events = await getCalendarEvents(grantId, NYLAS_SYNC_CONFIG.calendarLimit);
    console.log(`Fetched ${events.length} calendar events from Nylas`);

    const contactsMap = new Map<string, Contact>();
    const calendarInteractions: CalendarInteraction[] = [];

    // Get integration ID for tracking
    const supabase = createAdminClient();
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('nylas_grant_id', grantId)
      .single();

    const integrationId = integration?.id;

    for (const event of events) {
      // Skip events that don't have invitees (participants)
      // Only process events that have at least one participant/invitee (non-automated)
      const hasInvitees = event.participants && event.participants.length > 0 && 
        event.participants.some((p) => p.email && !isAutomatedEmail(p.email, undefined, p.name));
      
      if (!hasInvitees) {
        continue;
      }

      const date = event.when?.startTime
        ? new Date(event.when.startTime * 1000).toISOString()
        : new Date().toISOString();
      const subject = event.title || null;

      // Extract participants
      if (event.participants && event.participants.length > 0) {
        for (const participant of event.participants) {
          if (!participant.email || isAutomatedEmail(participant.email, undefined, participant.name)) {
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

          // Track calendar meeting interaction
          calendarInteractions.push({
            email: parsed.email,
            subject,
            occurred_at: date,
            event_id: event.id,
            calendar_id: event.calendarId || '',
          });
        }
      }

      // Extract organizer
      if (event.organizer?.email && !isAutomatedEmail(event.organizer.email, undefined, event.organizer.name)) {
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

        // Track calendar meeting interaction for organizer too
        calendarInteractions.push({
          email: parsed.email,
          subject,
          occurred_at: date,
          event_id: event.id,
          calendar_id: event.calendarId || '',
        });
      }
    }

    // Store contacts in database and get their IDs
    const contacts = Array.from(contactsMap.values());
    const emailToPerson = new Map<string, string>(); // email -> person_id

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

        emailToPerson.set(contact.email_address, existing.id);
      } else {
        // Insert new person
        const { data: newPerson } = await supabase
          .from('people')
          .insert({
            user_id: userId,
            name: contact.first_name && contact.last_name
              ? `${contact.first_name} ${contact.last_name}`
              : contact.first_name || contact.email_address,
            email: contact.email_address,
            starred: false,
            signal: false,
          })
          .select('id')
          .single();

        if (newPerson) {
          emailToPerson.set(contact.email_address, newPerson.id);
        }
      }
    }

    // Batch insert interactions - PostgreSQL unique index will skip duplicates
    console.log(`Batch inserting ${calendarInteractions.length} calendar interaction records`);

    // Prepare all interactions for batch insert
    const interactionsToInsert = calendarInteractions
      .filter(interaction => emailToPerson.has(interaction.email))
      .map(interaction => ({
        user_id: userId,
        person_id: emailToPerson.get(interaction.email),
        integration_id: integrationId,
        interaction_type: 'calendar_meeting',
        subject: interaction.subject,
        occurred_at: interaction.occurred_at,
        metadata: {
          event_id: interaction.event_id,
          calendar_id: interaction.calendar_id,
        },
      }));

    let interactionCount = 0;

    if (interactionsToInsert.length > 0) {
      // Batch insert using upsert with ignoreDuplicates
      // The unique index on (user_id, person_id, metadata->>'event_id') handles duplicates
      const { data: insertedInteractions, error } = await supabase
        .from('interactions')
        .upsert(interactionsToInsert, {
          onConflict: 'user_id,person_id,metadata->>event_id',
          ignoreDuplicates: true
        })
        .select('id');

      if (error) {
        // If upsert fails, fall back to insert (duplicates will be ignored by DB constraint)
        console.log('Upsert not supported, using insert with ignore duplicates behavior');
        const { error: insertError } = await supabase
          .from('interactions')
          .insert(interactionsToInsert);

        if (insertError && !insertError.message.includes('duplicate')) {
          console.error('Error batch inserting calendar interactions:', insertError);
        }
        interactionCount = interactionsToInsert.length;
      } else {
        interactionCount = insertedInteractions?.length || interactionsToInsert.length;
      }
    }

    // Batch timeline updates
    // Group interactions by person for timeline updates
    const interactionsByPerson = new Map<string, typeof calendarInteractions>();
    for (const interaction of calendarInteractions) {
      const personId = emailToPerson.get(interaction.email);
      if (!personId) continue;

      if (!interactionsByPerson.has(personId)) {
        interactionsByPerson.set(personId, []);
      }
      interactionsByPerson.get(personId)!.push(interaction);
    }

    // Fetch all people at once
    const personIds = Array.from(interactionsByPerson.keys());
    if (personIds.length > 0) {
      const { data: people } = await supabase
        .from('people')
        .select('id, timeline, name')
        .in('id', personIds);

      // Batch update timelines using Promise.all
      if (people && people.length > 0) {
        const timelineUpdates = people.map(person => {
          const interactions = interactionsByPerson.get(person.id) || [];
          const newEntries = interactions.map(interaction => ({
            type: 'meeting' as const,
            text: `You met with ${person.name.split(' ')[0]} ${interaction.subject || '(no title)'}`,
            date: new Date(interaction.occurred_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric'
            }),
            iconColor: 'blue' as const,
            link: interaction.subject || undefined,
          }));

          return {
            id: person.id,
            timeline: [...newEntries, ...(person.timeline || [])],
          };
        });

        console.log(`Batch updating timelines for ${timelineUpdates.length} people`);
        await Promise.all(
          timelineUpdates.map(update =>
            supabase.from('people').update({ timeline: update.timeline }).eq('id', update.id)
          )
        );
      }
    }

    console.log(`Calendar sync complete: ${contacts.length} contacts processed, ${interactionCount} interactions batch inserted`);
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
    // Run sequentially to avoid hitting Nylas rate limits
    const emailCount = await syncEmailContacts(grantId, userId);
    const calendarCount = await syncCalendarContacts(grantId, userId);

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
