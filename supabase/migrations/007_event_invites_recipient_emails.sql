ALTER TABLE event_invites
  ADD COLUMN IF NOT EXISTS recipient_emails TEXT[] DEFAULT '{}';
