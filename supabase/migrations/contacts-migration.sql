--This file is just for record keeping. To add a migration, use the supabase MCP tool. 

-- Create contacts table
create table contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  first_name text not null,
  last_name text not null,
  email_address text not null,
  company text,
  position text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create index for faster queries
create index contacts_user_id_idx on contacts(user_id);
create index contacts_email_idx on contacts(email_address);
create index contacts_created_at_idx on contacts(created_at desc);

-- Set up Row Level Security (RLS)
alter table contacts enable row level security;

-- Users can view their own contacts
create policy "Users can view their own contacts" on contacts
  for select using (auth.uid() = user_id);

-- Users can insert their own contacts
create policy "Users can insert their own contacts" on contacts
  for insert with check (auth.uid() = user_id);

-- Users can update their own contacts
create policy "Users can update their own contacts" on contacts
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own contacts
create policy "Users can delete their own contacts" on contacts
  for delete using (auth.uid() = user_id);

-- Function to update updated_at timestamp
create function update_contacts_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Trigger to update updated_at on contact update
create trigger on_contact_updated
  before update on contacts
  for each row execute procedure update_contacts_updated_at();

-- Add home address field
alter table contacts add column if not exists home_address text;

