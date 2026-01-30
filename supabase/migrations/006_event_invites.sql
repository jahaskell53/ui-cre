-- Store event invite batches (when "Invite Guests" is used)
CREATE TABLE IF NOT EXISTS event_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT,
  recipient_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_invites_event_id ON event_invites(event_id);
CREATE INDEX IF NOT EXISTS idx_event_invites_created_at ON event_invites(created_at DESC);

ALTER TABLE event_invites ENABLE ROW LEVEL SECURITY;

-- Event owner can view invites for their events
CREATE POLICY "Event owners can view event invites"
  ON event_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_invites.event_id AND e.user_id = auth.uid()
    )
  );

-- Event owner can insert invites for their events
CREATE POLICY "Event owners can insert event invites"
  ON event_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_invites.event_id AND e.user_id = auth.uid()
    )
    AND auth.uid() = user_id
  );
