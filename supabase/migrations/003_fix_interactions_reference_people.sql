-- Drop the old interactions table that references contacts
DROP TABLE IF EXISTS interactions CASCADE;

-- Recreate interactions table to reference people instead of contacts
CREATE TABLE interactions (
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
CREATE INDEX idx_interactions_user_id ON interactions(user_id);
CREATE INDEX idx_interactions_person_id ON interactions(person_id);
CREATE INDEX idx_interactions_occurred_at ON interactions(occurred_at DESC);

-- Enable Row Level Security
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for interactions
CREATE POLICY "Users can view their own interactions"
  ON interactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interactions"
  ON interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interactions"
  ON interactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interactions"
  ON interactions FOR DELETE
  USING (auth.uid() = user_id);
