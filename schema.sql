-- Create polls table
create table public.polls (
  id uuid default gen_random_uuid() primary key,
  question text not null,
  creator_id uuid references auth.users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  is_public boolean default true
);

-- Create options table
create table public.options (
  id uuid default gen_random_uuid() primary key,
  poll_id uuid references public.polls(id) on delete cascade not null,
  text text not null,
  vote_count bigint default 0
);

-- Create votes table
create table public.votes (
  id uuid default gen_random_uuid() primary key,
  poll_id uuid references public.polls(id) on delete cascade not null,
  option_id uuid references public.options(id) on delete cascade not null,
  voter_ip text, -- Optional: to limit duplicate votes from same IP if not logged in
  user_id uuid references auth.users(id), -- Optional: if logged in
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.polls enable row level security;
alter table public.options enable row level security;
alter table public.votes enable row level security;

-- Policies for Polls
-- Everyone can read polls
create policy "Polls are viewable by everyone" on public.polls
  for select using (true);

-- Only authenticated users can create polls
create policy "Users can create polls" on public.polls
  for insert with check (auth.uid() = creator_id);

-- Policies for Options
-- Everyone can read options
create policy "Options are viewable by everyone" on public.options
  for select using (true);

-- Options are created by the poll creator (handled via app logic usually, but we can allow insert if poll creator matches)
-- For simplicity, we'll allow authenticated users to insert options (application logic should ensure they own the poll)
create policy "Users can create options" on public.options
  for insert with check (auth.role() = 'authenticated');

-- Policies for Votes
-- Everyone can read votes (to see results)
create policy "Votes are viewable by everyone" on public.votes
  for select using (true);

-- Everyone can create votes (public voting)
create policy "Everyone can vote" on public.votes
  for insert with check (true);
