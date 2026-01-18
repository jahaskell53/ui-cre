-- Remove username column and constraint from profiles table
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS username_length,
  DROP COLUMN IF EXISTS username;
