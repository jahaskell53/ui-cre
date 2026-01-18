-- Remove the columns we added to contacts table (we're using people table instead)
ALTER TABLE contacts
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS first_interaction_at,
  DROP COLUMN IF EXISTS last_interaction_at,
  DROP COLUMN IF EXISTS interaction_count,
  DROP COLUMN IF EXISTS metadata;
