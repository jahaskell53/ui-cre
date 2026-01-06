-- Create a table for public profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  full_name text,
  avatar_url text,
  website text,
  constraint username_length check (char_length(username) >= 3)
);

-- Set up Row Level Security (RLS)
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- Trigger to create a profile entry on signup
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Create messages table
create table messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references auth.users on delete cascade not null,
  recipient_id uuid references auth.users on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  read_at timestamp with time zone,
  constraint content_not_empty check (char_length(trim(content)) > 0)
);

-- Create index for faster queries
create index messages_sender_recipient_idx on messages(sender_id, recipient_id);
create index messages_recipient_sender_idx on messages(recipient_id, sender_id);
create index messages_created_at_idx on messages(created_at desc);

-- Set up Row Level Security (RLS)
alter table messages enable row level security;

-- Users can view messages where they are sender or recipient
create policy "Users can view their own messages" on messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- Users can only send messages as themselves
create policy "Users can send messages" on messages
  for insert with check (auth.uid() = sender_id);

-- Users can only update read_at for messages they received
create policy "Users can mark their received messages as read" on messages
  for update using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);
