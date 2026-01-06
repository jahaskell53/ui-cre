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

-- Create notifications table
create table notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  type text not null default 'message',
  title text,
  content text not null,
  related_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  read_at timestamp with time zone,
  constraint content_not_empty check (char_length(trim(content)) > 0),
  constraint valid_type check (type in ('message', 'system', 'mention', 'like', 'comment'))
);

-- Create index for faster queries
create index notifications_user_id_idx on notifications(user_id);
create index notifications_user_unread_idx on notifications(user_id, read_at) where read_at is null;
create index notifications_created_at_idx on notifications(created_at desc);
create index notifications_type_idx on notifications(type);

-- Set up Row Level Security (RLS)
alter table notifications enable row level security;

-- Users can view their own notifications
create policy "Users can view their own notifications" on notifications
  for select using (auth.uid() = user_id);

-- System can insert notifications for users
create policy "System can insert notifications" on notifications
  for insert with check (true);

-- Users can update read_at for their own notifications
create policy "Users can mark their notifications as read" on notifications
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Function to create notification when message is sent
create function create_message_notification()
returns trigger as $$
begin
  insert into public.notifications (user_id, type, content, related_id)
  values (
    new.recipient_id,
    'message',
    new.content,
    new.id
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create notification on new message
create trigger on_message_created
  after insert on messages
  for each row execute procedure create_message_notification();
