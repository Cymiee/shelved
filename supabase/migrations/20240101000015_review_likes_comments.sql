-- Likes and comments on logs (a log's review, rating or status update).
--
-- Rules, enforced here rather than in the app:
--   * anyone can read likes and comments (reviews are public)
--   * you can only like or comment as yourself
--   * one like per person per log, and not on your own log
--   * comments are 1 to 1000 characters and cannot be edited, only deleted
--   * only the author can remove their own like or comment
--   * the timestamp is always the server's (clients cannot set created_at)

-- ── review_likes ─────────────────────────────────────────────────────────────
create table public.review_likes (
  log_id      uuid not null references public.game_logs(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (log_id, user_id)
);

create index review_likes_user_idx on public.review_likes (user_id);

alter table public.review_likes enable row level security;

create policy "anyone can read likes"
  on public.review_likes for select
  using (true);

create policy "like as yourself, not your own log"
  on public.review_likes for insert
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.game_logs l
      where l.id = log_id and l.user_id = auth.uid()
    )
  );

create policy "remove your own like"
  on public.review_likes for delete
  using (auth.uid() = user_id);

-- Column-level: a client supplies who and what, never when. No updates at all.
revoke insert, update on public.review_likes from anon, authenticated;
grant insert (log_id, user_id) on public.review_likes to authenticated;

-- ── review_comments ──────────────────────────────────────────────────────────
create table public.review_comments (
  id          uuid primary key default gen_random_uuid(),
  log_id      uuid not null references public.game_logs(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at  timestamptz not null default now()
);

create index review_comments_log_idx  on public.review_comments (log_id, created_at);
create index review_comments_user_idx on public.review_comments (user_id, created_at);

alter table public.review_comments enable row level security;

create policy "anyone can read comments"
  on public.review_comments for select
  using (true);

create policy "comment as yourself"
  on public.review_comments for insert
  with check (auth.uid() = user_id);

create policy "delete your own comment"
  on public.review_comments for delete
  using (auth.uid() = user_id);

revoke insert, update on public.review_comments from anon, authenticated;
grant insert (log_id, user_id, body) on public.review_comments to authenticated;

-- Flood brake: at most 10 comments a minute per person. A trigger rather than
-- part of the insert policy, so the policy never has to query its own table.
create or replace function public.limit_comment_rate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (
    select count(*) from public.review_comments c
    where c.user_id = new.user_id and c.created_at > now() - interval '1 minute'
  ) >= 10 then
    raise exception 'You are commenting too fast. Wait a minute and try again.';
  end if;
  return new;
end;
$$;

create trigger limit_comment_rate
  before insert on public.review_comments
  for each row execute function public.limit_comment_rate();

-- ── notification_reads ───────────────────────────────────────────────────────
-- When each person last looked at their notifications, so the badge can count
-- what is new. Private: you can only see and set your own row.
create table public.notification_reads (
  user_id  uuid primary key references public.users(id) on delete cascade,
  seen_at  timestamptz not null default now()
);

alter table public.notification_reads enable row level security;

create policy "read your own marker"
  on public.notification_reads for select
  using (auth.uid() = user_id);

create policy "create your own marker"
  on public.notification_reads for insert
  with check (auth.uid() = user_id);

create policy "move your own marker"
  on public.notification_reads for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Functions ────────────────────────────────────────────────────────────────
-- All run with the caller's own rights (security invoker), so the policies
-- above still apply inside them.

-- Counts for a batch of logs in one round trip, plus whether the caller liked each.
create or replace function public.review_engagement(log_ids uuid[])
returns table (log_id uuid, likes integer, comments integer, liked_by_me boolean)
language sql stable security invoker set search_path = public
as $$
  select
    l.id,
    (select count(*)::int from public.review_likes rl where rl.log_id = l.id),
    (select count(*)::int from public.review_comments rc where rc.log_id = l.id),
    exists (
      select 1 from public.review_likes rl
      where rl.log_id = l.id and rl.user_id = auth.uid()
    )
  from unnest(log_ids[1:200]) as l(id);
$$;

-- Likes and comments other people left on the caller's logs, newest first.
create or replace function public.review_notifications(max_rows integer default 30)
returns table (
  kind text,
  created_at timestamptz,
  actor_id uuid,
  actor_username text,
  actor_avatar_url text,
  log_id uuid,
  game_igdb_id integer,
  body text,
  unseen boolean
)
language sql stable security invoker set search_path = public
as $$
  with mine as (
    select id, game_igdb_id from public.game_logs where user_id = auth.uid()
  ),
  seen as (
    select coalesce(
      (select seen_at from public.notification_reads where user_id = auth.uid()),
      '-infinity'::timestamptz
    ) as last_seen
  ),
  events as (
    select 'like'::text as kind, rl.created_at, rl.user_id as actor_id, rl.log_id, null::text as body
    from public.review_likes rl
    where rl.log_id in (select id from mine) and rl.user_id <> auth.uid()
    union all
    select 'comment'::text, rc.created_at, rc.user_id, rc.log_id, rc.body
    from public.review_comments rc
    where rc.log_id in (select id from mine) and rc.user_id <> auth.uid()
  )
  select e.kind, e.created_at, e.actor_id, u.username, u.avatar_url,
         e.log_id, m.game_igdb_id, e.body, e.created_at > seen.last_seen
  from events e
  join mine m on m.id = e.log_id
  join public.users u on u.id = e.actor_id
  cross join seen
  order by e.created_at desc
  limit least(greatest(max_rows, 1), 100);
$$;

-- How many of those arrived since the caller last looked. Drives the badge.
create or replace function public.unseen_review_notification_count()
returns integer
language sql stable security invoker set search_path = public
as $$
  with mine as (
    select id from public.game_logs where user_id = auth.uid()
  ),
  seen as (
    select coalesce(
      (select seen_at from public.notification_reads where user_id = auth.uid()),
      '-infinity'::timestamptz
    ) as last_seen
  )
  select (
    (select count(*) from public.review_likes rl, seen
      where rl.log_id in (select id from mine) and rl.user_id <> auth.uid() and rl.created_at > seen.last_seen)
    +
    (select count(*) from public.review_comments rc, seen
      where rc.log_id in (select id from mine) and rc.user_id <> auth.uid() and rc.created_at > seen.last_seen)
  )::int;
$$;

-- "I've looked." Uses the server clock, the same one that stamps likes and
-- comments, so a device with a wrong clock cannot miss or repeat notifications.
create or replace function public.mark_review_notifications_seen()
returns void
language sql volatile security invoker set search_path = public
as $$
  insert into public.notification_reads (user_id, seen_at)
  values (auth.uid(), now())
  on conflict (user_id) do update set seen_at = excluded.seen_at;
$$;

-- Counts are public (signed-out visitors see them); the rest need a signed-in caller.
revoke execute on function public.review_notifications(integer) from public, anon;
revoke execute on function public.unseen_review_notification_count() from public, anon;
revoke execute on function public.mark_review_notifications_seen() from public, anon;
grant execute on function public.review_notifications(integer) to authenticated;
grant execute on function public.unseen_review_notification_count() to authenticated;
grant execute on function public.mark_review_notifications_seen() to authenticated;
grant execute on function public.review_engagement(uuid[]) to anon, authenticated;
