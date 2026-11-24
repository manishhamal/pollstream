-- =============================================================================
-- PollStream: Explore scaling (run AFTER secure_voting.sql)
--
-- Adds:  polls.total_votes (denormalized, maintained by cast_vote)
--        indexes for the Explore tabs (newest / popular / ending soon / ended)
--        trigram index for server-side search on polls.question
--
-- Re-runnable. Safe to apply before the new frontend: the old frontend
-- doesn't read total_votes and cast_vote keeps the same signature.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. polls.total_votes
-- -----------------------------------------------------------------------------
alter table public.polls add column if not exists total_votes bigint not null default 0;

-- Backfill from the per-option counters (which secure_voting.sql recounted from votes)
with t as (
  select p.id, coalesce((select sum(o.vote_count) from public.options o where o.poll_id = p.id), 0) as n
  from public.polls p
)
update public.polls p
set total_votes = t.n
from t
where p.id = t.id and p.total_votes is distinct from t.n;

alter table public.polls drop constraint if exists polls_total_votes_nonneg;
alter table public.polls add constraint polls_total_votes_nonneg check (total_votes >= 0);


-- -----------------------------------------------------------------------------
-- 2. Indexes for Explore
-- -----------------------------------------------------------------------------
-- Newest (active):        where ends_at > now() order by created_at desc   -> polls_created_at_idx (exists)
-- Ending soon (active):   where ends_at > now() order by ends_at asc
-- Ended:                  where ends_at <= now() order by ends_at desc
create index if not exists polls_ends_at_idx      on public.polls (ends_at);
-- Popular (active):       order by total_votes desc, created_at desc
create index if not exists polls_popular_idx      on public.polls (total_votes desc, created_at desc);
-- Category filter combined with any tab
create index if not exists polls_category_ends_idx on public.polls (category, ends_at);

-- Server-side search: question ILIKE '%term%' uses this trigram index
create extension if not exists pg_trgm with schema extensions;
create index if not exists polls_question_trgm_idx
  on public.polls using gin (question extensions.gin_trgm_ops);


-- -----------------------------------------------------------------------------
-- 3. cast_vote(): same rules as before, now also maintains polls.total_votes
--    (only a first vote changes the total; a revote moves a vote between options)
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
      raise exception 'You have already voted on this poll' using errcode = 'P0002';
    end;
    update public.options o set vote_count = o.vote_count + 1 where o.id = p_option_id;
    update public.polls p set total_votes = p.total_votes + 1 where p.id = p_poll_id;

  elsif v_old <> p_option_id then
    if v_at < now() - c_revote_window then
      raise exception 'Your vote is locked (revoting is only allowed for 15 seconds)'
        using errcode = 'P0003';
    end if;
    update public.votes v set option_id = p_option_id
    where v.poll_id = p_poll_id and v.user_id = v_uid;

    update public.options o
    set vote_count = o.vote_count + case when o.id = p_option_id then 1 else -1 end
    where o.id in (v_old, p_option_id);
  end if;

  return query
    select o.id, o.vote_count, p_option_id, v_at
    from public.options o
    where o.poll_id = p_poll_id;
end;
$$;
revoke execute on function public.cast_vote(uuid, uuid) from public, anon;
grant  execute on function public.cast_vote(uuid, uuid) to authenticated;
