--This file is just for record keeping. To add a migration, use the supabase MCP tool. 

-- Create people table
create table people (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  starred boolean default false not null,
  email text,
  signal boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create index for faster queries
create index people_user_id_idx on people(user_id);
create index people_starred_idx on people(user_id, starred) where starred = true;
create index people_created_at_idx on people(created_at desc);

-- Set up Row Level Security (RLS)
alter table people enable row level security;

-- Users can view their own people
create policy "Users can view their own people" on people
  for select using (auth.uid() = user_id);

-- Users can insert their own people
create policy "Users can insert their own people" on people
  for insert with check (auth.uid() = user_id);

-- Users can update their own people
create policy "Users can update their own people" on people
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own people
create policy "Users can delete their own people" on people
  for delete using (auth.uid() = user_id);

-- Function to update updated_at timestamp
create function update_people_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Trigger to update updated_at on people update
create trigger on_people_updated
  before update on people
  for each row execute procedure update_people_updated_at();

-- Add timeline column as JSONB array
alter table people add column if not exists timeline jsonb default '[]'::jsonb;

