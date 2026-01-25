import { getMessages, getCalendarEvents, NylasRateLimitError, type NylasMessage, type NylasCalendarEvent } from './client';
import { NYLAS_SYNC_CONFIG } from './config';
import { getLangfuseClient } from '../../../instrumentation';
import { createAdminClient } from '@/utils/supabase/admin';
import { recalculateNetworkStrengthForUser } from '@/lib/network-strength';
import { makeGeminiCall } from '@/lib/news/gemini';

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

interface EmailCheckInput {
  email: string;
  name?: string;
  subject?: string;
  headers?: Record<string, any>;
}

/**
 * Categorize email addresses using Gemini API
 * Categorizes the set of unique email addresses to determine which are important
 * Checks up to 20 emails at once (Gemini context limit)
 */
async function batchCheckAutomatedEmails(
  emailInputs: EmailCheckInput[],
  cache: Map<string, boolean>
): Promise<Map<string, boolean>> {
  const apiKey = process.env.GEMINI_API_KEY;
  const results = new Map<string, boolean>();

  if (!apiKey) {
    // Fallback to heuristics for all
    for (const input of emailInputs) {
      const cached = cache.get(input.email.toLowerCase());
      if (cached !== undefined) {
        results.set(input.email.toLowerCase(), cached);
      } else {
        const isAutomated = isAutomatedEmailFallback(input.email, undefined, input.name);
        results.set(input.email.toLowerCase(), isAutomated);
        cache.set(input.email.toLowerCase(), isAutomated);
      }
    }
    return results;
  }

  // Filter out already cached emails
  const toCheck = emailInputs.filter(input => {
    const cached = cache.get(input.email.toLowerCase());
    if (cached !== undefined) {
      results.set(input.email.toLowerCase(), cached);
      return false;
    }
    return true;
  });

  if (toCheck.length === 0) {
    return results;
  }

  // Process in batches of 20 (Gemini context limit)
  const BATCH_SIZE = 20;
  for (let i = 0; i < toCheck.length; i += BATCH_SIZE) {
    const batch = toCheck.slice(i, i + BATCH_SIZE);

    try {
      // Create a list of unique email addresses for categorization
      const emailList = batch.map((input, idx) => {
        return `${idx + 1}. ${input.email}${input.name ? ` (${input.name})` : ''}`;
      }).join('\n');

      const prompt = `Categorize the following set of email addresses. For each email address, assign it to one of these categories:

- "person": Email from a single human individual (personal or professional contact)
- "other": Everything else (newsletters, automated systems, bots, marketing, system notifications, etc.)

Email addresses:
${emailList}

Respond with a JSON object mapping each email address to its category. Format: {"john@example.com": "person", "newsletter@example.com": "other", ...}`;

      const response = await makeGeminiCall('gemini-2.5-flash-lite', prompt, {
        operation: 'categorizeEmailAddresses',
        // Note: Can't use responseSchema here because email addresses are dynamic keys
        // and Gemini requires explicit properties for OBJECT type
      });
      const text = response.candidates[0].content.parts[0].text.trim();

      // Try to parse JSON response
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          for (const input of batch) {
            const category = parsed[input.email.toLowerCase()] || parsed[input.email];
            // Only "person" is not automated; "other" is considered automated
            const isAutomated = category !== 'person';
            results.set(input.email.toLowerCase(), isAutomated);
            cache.set(input.email.toLowerCase(), isAutomated);
          }
        } else {
          // Fallback to heuristics if JSON parsing fails
          for (const input of batch) {
            const isAutomated = isAutomatedEmailFallback(input.email, undefined, input.name);
            results.set(input.email.toLowerCase(), isAutomated);
            cache.set(input.email.toLowerCase(), isAutomated);
          }
        }
      } catch (parseError) {
        // Fallback to heuristics on parse error
        for (const input of batch) {
          const isAutomated = isAutomatedEmailFallback(input.email, undefined, input.name);
          results.set(input.email.toLowerCase(), isAutomated);
          cache.set(input.email.toLowerCase(), isAutomated);
        }
      }
    } catch (error) {
      console.error(`Error categorizing email addresses (batch ${i / BATCH_SIZE + 1}):`, error);
      // Fallback to heuristics on error
      for (const input of batch) {
        const isAutomated = isAutomatedEmailFallback(input.email, undefined, input.name);
        results.set(input.email.toLowerCase(), isAutomated);
        cache.set(input.email.toLowerCase(), isAutomated);
      }
    }
  }

  return results;
}

/**
 * Check if an email is from a single person (not a bot, listserv, or newsletter)
 * Uses cached results if available, otherwise falls back to heuristics
 */
async function isAutomatedEmail(
  email: string,
  message?: NylasMessage,
  name?: string,
  cache?: Map<string, boolean>
): Promise<boolean> {
  // Use cache if provided
  if (cache) {
    const cached = cache.get(email.toLowerCase());
    if (cached !== undefined) {
      return cached;
    }
  }

  // Fallback to heuristics (will be replaced by batch checking)
  return isAutomatedEmailFallback(email, message, name);
}

/**
 * Fallback function with basic heuristics for when Gemini API is unavailable
 */
function isAutomatedEmailFallback(email: string, message?: NylasMessage, name?: string): boolean {
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
 * @param grantId - The Nylas grant ID
 * @param userId - The user ID
 * @param lastSyncAt - Optional timestamp of last sync (for incremental sync)
 */
export async function syncEmailContacts(grantId: string, userId: string, lastSyncAt?: Date | null) {
  try {
    const isIncremental = !!lastSyncAt;
    console.log(`Starting ${isIncremental ? 'incremental' : 'full'} email sync for grant ${grantId}`);

    // Convert lastSyncAt to Unix timestamp for Nylas API
    const receivedAfter = lastSyncAt ? Math.floor(lastSyncAt.getTime() / 1000) : undefined;

    const messages = await getMessages(grantId, NYLAS_SYNC_CONFIG.emailLimit, receivedAfter);
    console.log(`Fetched ${messages.length} ${isIncremental ? 'new ' : ''}messages from Nylas`);

    // Create Langfuse trace for email sync
    const langfuse = getLangfuseClient();
    const trace = langfuse?.trace({
      name: 'syncEmailContacts',
      metadata: {
        grantId,
        userId,
        isIncremental,
        totalMessages: messages.length,
      },
    });

    const contactsMap = new Map<string, Contact>();
    const emailInteractions: EmailInteraction[] = [];

    // Get integration ID and user email for tracking
    const supabase = createAdminClient();
    const { data: integration } = await supabase
      .from('integrations')
      .select('id, email_address')
      .eq('nylas_grant_id', grantId)
      .single();

    const integrationId = integration?.id;
    const userEmail = integration?.email_address?.toLowerCase();

    if (!userEmail) {
      console.error('No email address found for integration');
      return 0;
    }

    // Cache for automated email checks
    const automatedEmailCache = new Map<string, boolean>();

    // Step 1: Collect all unique emails for batch checking
    console.log('Step 1/5: Collecting unique email addresses...');
    const emailInputs: EmailCheckInput[] = [];
    const emailToMessage = new Map<string, NylasMessage>();

    for (const message of messages) {
      // Collect "to" addresses
      if (message.to && message.to.length > 0) {
        for (const to of message.to) {
          const parsed = parseEmailAddress(`${to.name || ''} <${to.email}>`);
          if (parsed.email && parsed.email.toLowerCase() !== userEmail) {
            const emailLower = parsed.email.toLowerCase();
            if (!emailToMessage.has(emailLower)) {
              emailInputs.push({
                email: parsed.email,
                name: parsed.name,
                subject: message.subject || undefined,
                headers: message.headers,
              });
              emailToMessage.set(emailLower, message);
            }
          }
        }
      }
      // Collect "from" addresses
      if (message.from && message.from.length > 0) {
        for (const from of message.from) {
          const parsed = parseEmailAddress(`${from.name || ''} <${from.email}>`);
          if (parsed.email && parsed.email.toLowerCase() !== userEmail) {
            const emailLower = parsed.email.toLowerCase();
            if (!emailToMessage.has(emailLower)) {
              emailInputs.push({
                email: parsed.email,
                name: parsed.name,
                subject: message.subject || undefined,
                headers: message.headers,
              });
              emailToMessage.set(emailLower, message);
            }
          }
        }
      }
    }

    console.log(`Collected ${emailInputs.length} unique email addresses`);

    // Step 2: Batch check all emails with Gemini
    console.log(`Step 2/5: Batch checking ${emailInputs.length} emails for automation...`);
    const automatedResults = await batchCheckAutomatedEmails(emailInputs, automatedEmailCache);
    console.log(`Completed batch check. Found ${Array.from(automatedResults.values()).filter(v => v).length} automated emails`);

    // Step 3: First pass - Identify contacts we've emailed
    console.log('Step 3/5: Processing messages to identify contacts...');
    const contactsWeveEmailed = new Set<string>();

    for (let i = 0; i < messages.length; i++) {
      if (i % 500 === 0 && i > 0) {
        console.log(`  Processed ${i}/${messages.length} messages...`);
      }

      const message = messages[i];
      const senderEmail = message.from?.[0]?.email?.toLowerCase();
      const isSentByUser = senderEmail === userEmail;

      if (isSentByUser && message.to && message.to.length > 0) {
        for (const to of message.to) {
          const parsed = parseEmailAddress(`${to.name || ''} <${to.email}>`);
          const emailLower = parsed.email?.toLowerCase();

          if (emailLower &&
            emailLower !== userEmail &&
            !automatedResults.get(emailLower)) {
            contactsWeveEmailed.add(emailLower);
          }
        }
      }
    }

    console.log(`Identified ${contactsWeveEmailed.size} contacts we've emailed`);

    // Step 4: Second pass - Process all messages and track interactions
    console.log('Step 4/5: Processing messages and tracking interactions...');
    for (let i = 0; i < messages.length; i++) {
      if (i % 500 === 0 && i > 0) {
        console.log(`  Processed ${i}/${messages.length} messages...`);
      }

      const message = messages[i];
      const date = message.date ? new Date(message.date * 1000).toISOString() : new Date().toISOString();
      const subject = message.subject || null;
      const senderEmail = message.from?.[0]?.email?.toLowerCase();
      const isSentByUser = senderEmail === userEmail;

      // Case 1: User SENT this email
      if (isSentByUser && message.to && message.to.length > 0) {
        for (const to of message.to) {
          const parsed = parseEmailAddress(`${to.name || ''} <${to.email}>`);
          const emailLower = parsed.email?.toLowerCase();

          if (emailLower &&
            emailLower !== userEmail &&
            !automatedResults.get(emailLower)) {
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

      // Case 2: User RECEIVED this email (from someone we've emailed before)
      if (!isSentByUser && message.from && message.from.length > 0) {
        const from = message.from[0];
        const parsed = parseEmailAddress(`${from.name || ''} <${from.email}>`);
        const emailLower = parsed.email?.toLowerCase();

        if (emailLower &&
          emailLower !== userEmail &&
          !automatedResults.get(emailLower) &&
          contactsWeveEmailed.has(emailLower)) {

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

    // Step 5: Store contacts in database (batched)
    const contacts = Array.from(contactsMap.values());
    console.log(`Step 5/5: Storing ${contacts.length} contacts in database...`);
    console.log(`Extracted ${contacts.length} unique contacts from emails`);

    const emailToPerson = new Map<string, string>(); // email -> person_id

    // Batch fetch existing contacts
    const contactEmails = contacts.map(c => c.email_address);
    const { data: existingPeople } = await supabase
      .from('people')
      .select('id, email')
      .eq('user_id', userId)
      .in('email', contactEmails);

    const existingEmailToId = new Map<string, string>();
    if (existingPeople) {
      for (const person of existingPeople) {
        existingEmailToId.set(person.email.toLowerCase(), person.id);
      }
    }

    // Separate contacts into updates and inserts
    const contactsToUpdate: Array<{ id: string; name: string }> = [];
    const contactsToInsert: Array<{ user_id: string; name: string; email: string; starred: boolean; signal: boolean }> = [];

    for (const contact of contacts) {
      const existingId = existingEmailToId.get(contact.email_address.toLowerCase());
      const name = contact.first_name && contact.last_name
        ? `${contact.first_name} ${contact.last_name}`
        : contact.first_name || contact.email_address;

      if (existingId) {
        contactsToUpdate.push({ id: existingId, name });
        emailToPerson.set(contact.email_address, existingId);
      } else {
        contactsToInsert.push({
          user_id: userId,
          name,
          email: contact.email_address,
          starred: false,
          signal: false,
        });
      }
    }

    // Batch update existing contacts
    if (contactsToUpdate.length > 0) {
      console.log(`  Updating ${contactsToUpdate.length} existing contacts...`);
      await Promise.all(
        contactsToUpdate.map(contact =>
          supabase
            .from('people')
            .update({ name: contact.name, updated_at: new Date().toISOString() })
            .eq('id', contact.id)
        )
      );
    }

    // Batch insert new contacts
    if (contactsToInsert.length > 0) {
      console.log(`  Inserting ${contactsToInsert.length} new contacts...`);
      const { data: newPeople } = await supabase
        .from('people')
        .insert(contactsToInsert)
        .select('id, email');

      if (newPeople) {
        for (const person of newPeople) {
          emailToPerson.set(person.email, person.id);
        }
      }
    }

    // Batch insert interactions - PostgreSQL unique index will skip duplicates
    console.log(`Batch inserting ${emailInteractions.length} interaction records...`);

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

    // Recalculate network strength for all people after timeline updates
    console.log('Recalculating network strength...');
    await recalculateNetworkStrengthForUser(supabase, userId);

    // Update trace with final results
    const automatedCount = Array.from(automatedResults.values()).filter(v => v).length;
    trace?.update({
      output: {
        contactsProcessed: contacts.length,
        interactionsInserted: interactionCount,
        messagesProcessed: messages.length,
        uniqueEmails: emailInputs.length,
        automatedFiltered: automatedCount,
        contactsWeveEmailed: contactsWeveEmailed.size,
      },
    });

    console.log(`✅ Email sync complete: ${contacts.length} contacts processed, ${interactionCount} interactions batch inserted`);
    return contacts.length;
  } catch (error) {
    console.error('Error syncing email contacts:', error);
    trace?.update({
      output: { error: error instanceof Error ? error.message : 'Unknown error' },
      level: 'ERROR',
    });
    throw error;
  }
}

/**
 * Sync contacts from calendar events
 * @param grantId - The Nylas grant ID
 * @param userId - The user ID
 * @param lastSyncAt - Optional timestamp of last sync (for incremental sync)
 */
export async function syncCalendarContacts(grantId: string, userId: string, lastSyncAt?: Date | null) {
  try {
    const isIncremental = !!lastSyncAt;
    console.log(`Starting ${isIncremental ? 'incremental' : 'full'} calendar sync for grant ${grantId}`);

    // Convert lastSyncAt to Unix timestamp for Nylas API
    const startAfter = lastSyncAt ? Math.floor(lastSyncAt.getTime() / 1000) : undefined;

    const events = await getCalendarEvents(grantId, NYLAS_SYNC_CONFIG.calendarLimit, startAfter);
    console.log(`Fetched ${events.length} ${isIncremental ? 'new ' : ''}calendar events from Nylas`);

    // Create Langfuse trace for calendar filtering
    const langfuse = getLangfuseClient();
    const trace = langfuse?.trace({
      name: 'syncCalendarContacts',
      metadata: {
        grantId,
        userId,
        isIncremental,
        totalEvents: events.length,
      },
    });

    const contactsMap = new Map<string, Contact>();
    const calendarInteractions: CalendarInteraction[] = [];
    let eventsFiltered = 0;
    let eventsProcessed = 0;

    // Get integration ID and user email for tracking
    const supabase = createAdminClient();
    const { data: integration } = await supabase
      .from('integrations')
      .select('id, email_address')
      .eq('nylas_grant_id', grantId)
      .single();

    const integrationId = integration?.id;
    const userEmail = integration?.email_address?.toLowerCase();

    // Create span for filtering logic
    const filterSpan = trace?.span({
      name: 'filterCalendarEvents',
      input: {
        totalEvents: events.length,
        userEmail,
      },
    });

    for (const event of events) {
      // Skip events that don't have invitees (participants)
      // Only process events that have at least one participant/invitee (non-automated)
      let hasInvitees = false;
      if (event.participants && event.participants.length > 0) {
        for (const p of event.participants) {
          if (p.email && !(await isAutomatedEmail(p.email, undefined, p.name))) {
            hasInvitees = true;
            break;
          }
        }
      }

      if (!hasInvitees) {
        eventsFiltered++;
        continue;
      }

      eventsProcessed++;

      const date = event.when?.startTime
        ? new Date(event.when.startTime * 1000).toISOString()
        : new Date().toISOString();
      const subject = event.title || null;

      // Extract participants
      if (event.participants && event.participants.length > 0) {
        for (const participant of event.participants) {
          if (!participant.email ||
            (await isAutomatedEmail(participant.email, undefined, participant.name)) ||
            (!userEmail || participant.email.toLowerCase() === userEmail)) {
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
      if (event.organizer?.email &&
        !(await isAutomatedEmail(event.organizer.email, undefined, event.organizer.name)) &&
        (!userEmail || event.organizer.email.toLowerCase() !== userEmail)) {
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

    // End filter span with results
    filterSpan?.end({
      output: {
        eventsProcessed,
        eventsFiltered,
        uniqueContacts: contactsMap.size,
        totalInteractions: calendarInteractions.length,
      },
    });

    // Store contacts in database (batched)
    const contacts = Array.from(contactsMap.values());
    const emailToPerson = new Map<string, string>();

    // Batch fetch existing contacts
    const contactEmails = contacts.map(c => c.email_address);
    const { data: existingPeople } = await supabase
      .from('people')
      .select('id, email')
      .eq('user_id', userId)
      .in('email', contactEmails);

    const existingEmailToId = new Map<string, string>();
    if (existingPeople) {
      for (const person of existingPeople) {
        existingEmailToId.set(person.email.toLowerCase(), person.id);
      }
    }

    // Separate contacts into updates and inserts
    const contactsToUpdate: Array<{ id: string; name: string }> = [];
    const contactsToInsert: Array<{ user_id: string; name: string; email: string; starred: boolean; signal: boolean }> = [];

    for (const contact of contacts) {
      const existingId = existingEmailToId.get(contact.email_address.toLowerCase());
      const name = contact.first_name && contact.last_name
        ? `${contact.first_name} ${contact.last_name}`
        : contact.first_name || contact.email_address;

      if (existingId) {
        contactsToUpdate.push({ id: existingId, name });
        emailToPerson.set(contact.email_address, existingId);
      } else {
        contactsToInsert.push({
          user_id: userId,
          name,
          email: contact.email_address,
          starred: false,
          signal: false,
        });
      }
    }

    // Batch update existing contacts
    if (contactsToUpdate.length > 0) {
      await Promise.all(
        contactsToUpdate.map(contact =>
          supabase
            .from('people')
            .update({ name: contact.name, updated_at: new Date().toISOString() })
            .eq('id', contact.id)
        )
      );
    }

    // Batch insert new contacts
    if (contactsToInsert.length > 0) {
      const { data: newPeople } = await supabase
        .from('people')
        .insert(contactsToInsert)
        .select('id, email');

      if (newPeople) {
        for (const person of newPeople) {
          emailToPerson.set(person.email, person.id);
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

    // Recalculate network strength for all people after timeline updates
    await recalculateNetworkStrengthForUser(supabase, userId);

    // Update trace with final results
    trace?.update({
      output: {
        contactsProcessed: contacts.length,
        interactionsInserted: interactionCount,
        eventsFiltered,
        eventsProcessed,
      },
    });

    console.log(`Calendar sync complete: ${contacts.length} contacts processed, ${interactionCount} interactions batch inserted`);
    return contacts.length;
  } catch (error) {
    console.error('Error syncing calendar contacts:', error);
    trace?.update({
      output: { error: error instanceof Error ? error.message : 'Unknown error' },
      level: 'ERROR',
    });
    throw error;
  }
}

/**
 * Result from sync operation
 */
export interface SyncResult {
  emailCount: number;
  calendarCount: number;
  isIncremental: boolean;
  rateLimited?: boolean;
  retryAfterMs?: number;
}

/**
 * Sync all contacts from both email and calendar
 * Performs incremental sync if last_sync_at exists, otherwise full sync
 * Handles rate limits gracefully by saving partial results and signaling for delayed retry
 */
export async function syncAllContacts(grantId: string, userId: string): Promise<SyncResult> {
  const supabase = createAdminClient();

  // Fetch integration to get last_sync_at for incremental sync
  const { data: integration } = await supabase
    .from('integrations')
    .select('first_sync_at, last_sync_at')
    .eq('nylas_grant_id', grantId)
    .single();

  const lastSyncAt = integration?.last_sync_at ? new Date(integration.last_sync_at) : null;
  const isFirstSync = !integration?.first_sync_at;

  if (lastSyncAt) {
    console.log(`Incremental sync: fetching data since ${lastSyncAt.toISOString()}`);
  } else {
    console.log('Full sync: no previous sync timestamp found');
  }

  let emailCount = 0;
  let calendarCount = 0;
  let rateLimited = false;
  let retryAfterMs: number | undefined;

  try {
    // Run sequentially to avoid hitting Nylas rate limits
    emailCount = await syncEmailContacts(grantId, userId, lastSyncAt);
  } catch (error) {
    if (error instanceof NylasRateLimitError) {
      console.log(`Email sync rate limited. Collected ${error.itemsCollected} items before limit.`);
      rateLimited = true;
      retryAfterMs = error.retryAfterMs;
      // Continue to try calendar sync - it might work if rate limit is per-endpoint
    } else {
      console.error('Error syncing email contacts:', error);
      // Update integration with error status
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

  try {
    calendarCount = await syncCalendarContacts(grantId, userId, lastSyncAt);
  } catch (error) {
    if (error instanceof NylasRateLimitError) {
      console.log(`Calendar sync rate limited. Collected ${error.itemsCollected} items before limit.`);
      rateLimited = true;
      // Use the longer retry delay if both are rate limited
      retryAfterMs = Math.max(retryAfterMs || 0, error.retryAfterMs);
    } else {
      console.error('Error syncing calendar contacts:', error);
      // Update integration with error status
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

  // Update integration sync status
  if (rateLimited) {
    // Partial sync completed - mark as rate_limited so we can retry later
    await supabase
      .from('integrations')
      .update({
        status: 'rate_limited',
        sync_error: `Rate limited. Retry after ${Math.round((retryAfterMs || 60000) / 1000)}s. Partial sync: ${emailCount} emails, ${calendarCount} calendar events.`,
        // Don't update last_sync_at so next sync picks up where we left off
      })
      .eq('nylas_grant_id', grantId);

    console.log(`Partial sync completed: ${emailCount} emails, ${calendarCount} calendar events. Rate limited - retry after ${Math.round((retryAfterMs || 60000) / 1000)}s`);
  } else {
    // Full sync completed successfully
    const updateData: Record<string, any> = {
      last_sync_at: new Date().toISOString(),
      status: 'active',
      sync_error: null,
    };

    // Only set first_sync_at on the first sync
    if (isFirstSync) {
      updateData.first_sync_at = new Date().toISOString();
    }

    await supabase
      .from('integrations')
      .update(updateData)
      .eq('nylas_grant_id', grantId);

    console.log(`Sync completed successfully: ${emailCount} emails, ${calendarCount} calendar events`);
  }

  return {
    emailCount,
    calendarCount,
    isIncremental: !!lastSyncAt,
    rateLimited,
    retryAfterMs,
  };
}
