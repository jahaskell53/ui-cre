# Nylas API Mock Mode

Mock mode allows you to test the email/calendar sync functionality without making actual Nylas API calls. Instead of fetching real data, it returns predefined mock data that will be processed and stored in the database.

## Enabling Mock Mode

Set the following environment variable:

```bash
MOCK_NYLAS_API=true
```

Optionally, set the mock user email (must match your integration's `email_address` in the database):

```bash
MOCK_USER_EMAIL=your-test-email@example.com
```

If not set, `MOCK_USER_EMAIL` defaults to `mock-user@example.com`.

## Mock Data

When mock mode is enabled, the following data is returned:

### Emails (2 messages)

| Direction | From | To | Subject |
|-----------|------|-----|---------|
| Sent | User | john.doe@example.com | "Quick question about the project" |
| Received | john.doe@example.com | User | "Re: Quick question about the project" |

### Calendar Events (1 event)

| Title | Organizer | Participants |
|-------|-----------|--------------|
| "Project Sync with John" | John Doe (john.doe@example.com) | John Doe, User |

## How It Works

When `MOCK_NYLAS_API=true`, the following functions return mock data instead of calling the Nylas API:

- `getMessages()` - Returns mock email messages
- `getCalendarEvents()` - Returns mock calendar events
- `getCalendars()` - Returns a mock calendar list
- `getGrant()` - Returns a mock grant object

The mock data is in the exact format expected by the sync functions (`syncEmailContacts`, `syncCalendarContacts`), so:

1. **John Doe** will be added as a contact in the `people` table
2. **2 email interactions** will be recorded (1 sent, 1 received)
3. **1 calendar meeting interaction** will be recorded
4. Timeline entries will be created for the contact

## Requirements

For mock mode to work properly:

1. You need an existing **integration** row in the database with a valid `nylas_grant_id`
2. The integration's `email_address` must match `MOCK_USER_EMAIL`
3. The integration must be associated with a valid `user_id`

## Example Usage

1. Create/update an integration in the database:
   ```sql
   UPDATE integrations
   SET email_address = 'mock-user@example.com'
   WHERE nylas_grant_id = 'your-grant-id';
   ```

2. Set environment variables:
   ```bash
   export MOCK_NYLAS_API=true
   export MOCK_USER_EMAIL=mock-user@example.com
   ```

3. Trigger a sync (via API or Lambda):
   ```bash
   # The sync will use mock data instead of calling Nylas
   ```

4. Check the database for the new contact:
   ```sql
   SELECT * FROM people WHERE email = 'john.doe@example.com';
   SELECT * FROM interactions WHERE person_id = '<john-doe-person-id>';
   ```

## Console Output

When mock mode is enabled, you'll see logs like:

```
[Nylas Mock] ✅ Mock mode ENABLED
[Nylas Mock] Mock user email: mock-user@example.com
[Nylas Mock] To use: ensure your integration's email_address matches MOCK_USER_EMAIL
[Nylas Mock] Mock data includes: 1 sent email, 1 received email, 1 calendar event with John Doe
[Nylas Mock] Returning mock email messages
[Nylas Mock] Returning mock calendar events
```

## Files

- `src/lib/nylas/mock.ts` - Mock data generators
- `src/lib/nylas/client.ts` - API client with mock mode checks
