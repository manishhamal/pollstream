-- =============================================================================
-- PollStream: secure voting migration (Top Actions #1 + #2)
--
-- Closes:  admin self-escalation, ballot stuffing, option injection,
--          creator-email leak, voter-identity leak, anon revote hijacking.
-- Adds:    polls.category / polls.ends_at, profiles, FK indexes,
--          one-vote-per-user, cast_vote() and create_poll() RPCs.
--
-- Written to be re-runnable (IF EXISTS / IF NOT EXISTS) because the live DB
-- state depends on which of the old loose .sql scripts were applied.
--
-- PREREQUISITES (dashboard):
--   Authentication -> Sign In / Providers -> enable "Allow anonymous sign-ins"
--   (recommended: also enable CAPTCHA protection on the same page)
--
-- DEPLOY ORDER: run this, then deploy the frontend immediately. The old
-- frontend calls record_vote/revote/polls_with_creator, which are removed here.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Schema: persist what the UI already collects
-- -----------------------------------------------------------------------------
alter table public.polls add column if not exists category text not null default 'General';
alter table public.polls add column if not exists ends_at timestamptz;

-- Backfill to match the old hardcoded client behaviour (created_at + 24h)
update public.polls set ends_at = created_at + interval '24 hours' where ends_at is null;
alter table public.polls alter column ends_at set not null;
alter table public.polls alter column ends_at set default now() + interval '24 hours';

alter table public.polls drop constraint if exists polls_category_check;
alter table public.polls add constraint polls_category_check
  check (category in ('General','Tech','Sports','Entertainment','Politics'));

alter table public.polls drop constraint if exists polls_question_len;
alter table public.polls add constraint polls_question_len
  check (char_length(btrim(question)) between 1 and 280) not valid;  -- don't fail on legacy rows

alter table public.options drop constraint if exists options_text_len;
alter table public.options add constraint options_text_len
  check (char_length(btrim(text)) between 1 and 100) not valid;

alter table public.options alter column vote_count set not null;
alter table public.options drop constraint if exists options_vote_count_nonneg;
alter table public.options add constraint options_vote_count_nonneg check (vote_count >= 0) not valid;


-- -----------------------------------------------------------------------------
-- 2. Profiles (public display name instead of exposing auth.users.email)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone" on public.profiles
  for select using (true);
-- No insert/update/delete policies: rows are written only by the trigger / RPC below.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.is_anonymous, false) then
    return new;  -- anonymous voters don't need a public profile
  end if;
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name',
             split_part(new.email, '@', 1),
             'User'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for every existing poll creator (and other real users)
insert into public.profiles (id, display_name, avatar_url)
select u.id,
       coalesce(u.raw_user_meta_data->>'full_name',
                u.raw_user_meta_data->>'name',
                split_part(u.email, '@', 1),
                'User'),
       u.raw_user_meta_data->>'avatar_url'
from auth.users u
where not coalesce(u.is_anonymous, false)
   or exists (select 1 from public.polls p where p.creator_id = u.id)
on conflict (id) do nothing;

-- Second FK so PostgREST can embed profiles from polls: polls -> profiles
alter table public.polls drop constraint if exists polls_creator_profile_fk;
alter table public.polls add constraint polls_creator_profile_fk
  foreign key (creator_id) references public.profiles(id) on delete cascade;


-- -----------------------------------------------------------------------------
-- 3. Remove the leaks and the insecure entry points
-- -----------------------------------------------------------------------------
-- S4: creator email leak
drop view if exists public.polls_with_creator;
drop function if exists public.get_user_email(uuid);

-- S2/S6: old voting paths (replaced by cast_vote)
drop function if exists public.record_vote(uuid, uuid);
drop function if exists public.revote(uuid, uuid, uuid);
drop trigger  if exists trigger_increment_vote_count on public.votes;
drop function if exists public.increment_vote_count();

-- S2/S5: clients can no longer write votes directly or read other people's votes
drop policy if exists "Everyone can vote"              on public.votes;
drop policy if exists "Votes are viewable by everyone" on public.votes;
drop policy if exists "Users can read own votes"       on public.votes;
create policy "Users can read own votes" on public.votes
  for select using (user_id = auth.uid());

-- S3: options/polls are created only through create_poll()
drop policy if exists "Users can create options" on public.options;
drop policy if exists "Users can create polls"   on public.polls;

-- Belt and braces: even if someone re-adds a permissive policy later,
-- table-level privileges still block direct writes from the browser.
revoke insert, update, delete on public.votes   from anon, authenticated;
revoke insert, update         on public.options from anon, authenticated;
revoke insert, update         on public.polls   from anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;


-- -----------------------------------------------------------------------------
-- 4. S1/S7: admin = app_metadata (writable only with the service role)
-- -----------------------------------------------------------------------------
drop policy if exists "Admins can delete any poll" on public.polls;
drop function if exists public.is_admin(uuid);

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
$$;

create policy "Admins can delete any poll" on public.polls
  for delete using ((select public.is_admin()));

-- Grant admin (run once per admin, then that user must sign out/in to refresh the JWT):
--   update auth.users
--   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"is_admin": true}'
--   where email = '<admin email>';


-- -----------------------------------------------------------------------------
-- 5. Data repair + one vote per user
-- -----------------------------------------------------------------------------
-- Remove duplicate signed-in votes (keep the most recent) so the unique index can build
delete from public.votes v
using (
  select id,
         row_number() over (partition by poll_id, user_id order by created_at desc, id) as rn
  from public.votes
  where user_id is not null
) d
where v.id = d.id and d.rn > 1;

-- Drop votes whose option belongs to a different poll (injected rows)
delete from public.votes v
using public.options o
where v.option_id = o.id and o.poll_id <> v.poll_id;

-- Recount from the votes table: it is the source of truth.
-- Fixes drift from the old trigger/double-count/revote bugs.
with c as (
  select o.id, (select count(*) from public.votes v where v.option_id = o.id) as n
  from public.options o
)
update public.options o
set vote_count = c.n
from c
where o.id = c.id and o.vote_count is distinct from c.n;

alter table public.options validate constraint options_vote_count_nonneg;

create unique index if not exists votes_one_per_user  on public.votes (poll_id, user_id);
create index if not exists votes_option_id_idx        on public.votes (option_id);
create index if not exists options_poll_id_idx        on public.options (poll_id);
create index if not exists polls_created_at_idx       on public.polls (created_at desc);
create index if not exists polls_creator_id_idx       on public.polls (creator_id);


-- -----------------------------------------------------------------------------
-- 6. create_poll(): one transaction for poll + options, server-side validation
-- -----------------------------------------------------------------------------
create or replace function public.create_poll(
  p_question       text,
  p_options        text[],
  p_category       text default 'General',
  p_duration_hours int  default 24
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_poll_id uuid;
  v_opts    text[];
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Sign in to create a poll' using errcode = '28000';
  end if;

  if p_duration_hours not in (1, 6, 24, 72, 168) then
    raise exception 'Invalid duration' using errcode = '22023';
  end if;

  -- trim, drop blanks, de-duplicate (case-insensitive), keep order
  select array_agg(t order by ord)
  into v_opts
  from (
    select distinct on (lower(btrim(x))) btrim(x) as t, ord
    from unnest(p_options) with ordinality as u(x, ord)
    where btrim(x) <> ''
    order by lower(btrim(x)), ord
  ) s;

  if coalesce(array_length(v_opts, 1), 0) not between 2 and 10 then
    raise exception 'A poll needs between 2 and 10 distinct options' using errcode = '22023';
  end if;

  -- Defensive: make sure the creator has a profile (FK target)
  insert into public.profiles (id, display_name)
  select u.id, coalesce(u.raw_user_meta_data->>'full_name',
                        u.raw_user_meta_data->>'name',
                        split_part(u.email, '@', 1), 'User')
  from auth.users u where u.id = v_uid
  on conflict (id) do nothing;

  insert into public.polls (question, creator_id, category, ends_at, is_public)
  values (btrim(p_question), v_uid, p_category,
          now() + make_interval(hours => p_duration_hours), true)
  returning id into v_poll_id;   -- check constraints validate question/category

  insert into public.options (poll_id, text, vote_count)
  select v_poll_id, u.t, 0 from unnest(v_opts) as u(t);

  return v_poll_id;
end;
$$;
revoke execute on function public.create_poll(text, text[], text, int) from public, anon;
grant  execute on function public.create_poll(text, text[], text, int) to authenticated;


-- -----------------------------------------------------------------------------
-- 7. cast_vote(): the only way to vote. Server owns every rule.
--    Anonymous visitors get a real auth.uid() via signInAnonymously().
-- -----------------------------------------------------------------------------
create or replace function public.cast_vote(p_poll_id uuid, p_option_id uuid)
returns table (option_id uuid, vote_count bigint, voted_option_id uuid, voted_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid  uuid := auth.uid();
  v_old  uuid;
  v_at   timestamptz;
  c_revote_window constant interval := interval '15 seconds';
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  perform 1 from public.polls p where p.id = p_poll_id and p.ends_at > now();
  if not found then
    raise exception 'This poll is closed' using errcode = 'P0001';
  end if;

  perform 1 from public.options o where o.id = p_option_id and o.poll_id = p_poll_id;
  if not found then
    raise exception 'Option does not belong to this poll' using errcode = '22023';
  end if;

  -- Lock this user's existing vote row (if any) to serialize double-clicks / races
  select v.option_id, v.created_at into v_old, v_at
  from public.votes v
  where v.poll_id = p_poll_id and v.user_id = v_uid
  for update;

  if v_old is null then
    begin
      insert into public.votes (poll_id, option_id, user_id)
      values (p_poll_id, p_option_id, v_uid)
      returning created_at into v_at;
    exception when unique_violation then
      -- a concurrent call from the same user won the race; treat as already voted
      raise exception 'You have already voted on this poll' using errcode = 'P0002';
    end;
    update public.options o set vote_count = o.vote_count + 1 where o.id = p_option_id;

  elsif v_old <> p_option_id then
    if v_at < now() - c_revote_window then
      raise exception 'Your vote is locked (revoting is only allowed for 15 seconds)'
        using errcode = 'P0003';
    end if;
    -- created_at is NOT reset: the window runs from the first vote
    update public.votes v set option_id = p_option_id
    where v.poll_id = p_poll_id and v.user_id = v_uid;

    update public.options o
    set vote_count = o.vote_count + case when o.id = p_option_id then 1 else -1 end
    where o.id in (v_old, p_option_id);
  end if;
  -- same option again: no-op, just return current tallies

  return query
    select o.id, o.vote_count, p_option_id, v_at
    from public.options o
    where o.poll_id = p_poll_id;
end;
$$;
revoke execute on function public.cast_vote(uuid, uuid) from public, anon;
grant  execute on function public.cast_vote(uuid, uuid) to authenticated;  -- includes anonymous sign-ins


-- -----------------------------------------------------------------------------
-- 8. Realtime: make sure options is published (unchanged behaviour)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'options'
  ) then
    alter publication supabase_realtime add table public.options;
  end if;
end
$$;
