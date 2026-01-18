-- Create integrations table to store user email/calendar connections
CREATE TABLE IF NOT EXISTS integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nylas_grant_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL, -- 'gmail', 'outlook', 'yahoo', 'icloud', etc.
  email_address TEXT NOT NULL,
  integration_type TEXT NOT NULL, -- 'email', 'calendar', or 'both'
  status TEXT DEFAULT 'active', -- 'active', 'syncing', 'error', 'disconnected'
  first_sync_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for integrations
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_nylas_grant_id ON integrations(nylas_grant_id);

-- Create interactions table to track email/calendar interactions
-- References people table instead of contacts
CREATE TABLE IF NOT EXISTS interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
  interaction_type TEXT NOT NULL, -- 'email_sent', 'email_received', 'calendar_meeting'
  subject TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for interactions
CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_person_id ON interactions(person_id);
CREATE INDEX IF NOT EXISTS idx_interactions_occurred_at ON interactions(occurred_at DESC);

-- Enable Row Level Security
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for integrations
DROP POLICY IF EXISTS "Users can view their own integrations" ON integrations;
CREATE POLICY "Users can view their own integrations"
  ON integrations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own integrations" ON integrations;
CREATE POLICY "Users can insert their own integrations"
  ON integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own integrations" ON integrations;
CREATE POLICY "Users can update their own integrations"
  ON integrations FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own integrations" ON integrations;
CREATE POLICY "Users can delete their own integrations"
  ON integrations FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for interactions
DROP POLICY IF EXISTS "Users can view their own interactions" ON interactions;
CREATE POLICY "Users can view their own interactions"
  ON interactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own interactions" ON interactions;
CREATE POLICY "Users can insert their own interactions"
  ON interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own interactions" ON interactions;
CREATE POLICY "Users can update their own interactions"
  ON interactions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own interactions" ON interactions;
CREATE POLICY "Users can delete their own interactions"
  ON interactions FOR DELETE
  USING (auth.uid() = user_id);
