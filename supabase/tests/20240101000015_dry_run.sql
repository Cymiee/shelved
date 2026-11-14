-- DRY RUN for migrations 20240101000015 and 20240101000016. Changes nothing.
--
-- How to use: paste this whole file into the Supabase SQL editor and run it
-- BEFORE running the two migration files. It creates the tables and functions,
-- acts as a review's owner, as another signed-in user and as a signed-out
-- visitor, then deliberately fails so Postgres rolls everything back.
--
-- Expected result: an ERROR whose message starts "DRY RUN, ROLLED BACK"
-- followed by one "ok: ..." entry per check. Any "FAIL: ..." entry, or a
-- different error, means stop and do not apply the migrations.
--
-- One-off: once the migrations are applied this file can be deleted (it would
-- fail with "relation already exists").

do $dry$
declare u1 uuid; u2 uuid; log1 uuid; cid uuid; n int; r text := ''; rec record;
begin
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
revoke insert, update on public.review_likes from anon, authenticated;
grant insert (log_id, user_id) on public.review_likes to authenticated;
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
create or replace function public.mark_review_notifications_seen()
returns void
language sql volatile security invoker set search_path = public
as $$
  insert into public.notification_reads (user_id, seen_at)
  values (auth.uid(), now())
  on conflict (user_id) do update set seen_at = excluded.seen_at;
$$;
revoke execute on function public.review_notifications(integer) from public, anon;
revoke execute on function public.unseen_review_notification_count() from public, anon;
revoke execute on function public.mark_review_notifications_seen() from public, anon;
grant execute on function public.review_notifications(integer) to authenticated;
grant execute on function public.unseen_review_notification_count() to authenticated;
grant execute on function public.mark_review_notifications_seen() to authenticated;
grant execute on function public.review_engagement(uuid[]) to anon, authenticated;
create or replace function public.bump_igdb_rate(p_key text, p_window_seconds integer)
returns integer
language sql volatile security invoker set search_path = public
as $$
  insert into public.igdb_cache as c (key, value, expires_at)
  values (p_key, '1'::jsonb, now() + make_interval(secs => greatest(p_window_seconds, 1)))
  on conflict (key) do update
    set value = to_jsonb((c.value #>> '{}')::integer + 1)
  returning (value #>> '{}')::integer;
$$;
revoke execute on function public.bump_igdb_rate(text, integer) from public, anon, authenticated;
grant execute on function public.bump_igdb_rate(text, integer) to service_role;
select gl.id, gl.user_id into log1, u1 from public.game_logs gl order by gl.created_at limit 1;
select id into u2 from public.users where id <> u1 order by created_at limit 1;
n := public.bump_igdb_rate('rl:dryrun:1', 60);
n := public.bump_igdb_rate('rl:dryrun:1', 60);
r := r || ' | ' || case when n = 2 then 'ok' else 'FAIL' end || ': rate counter counts to ' || n;
perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
execute 'set local role authenticated';
begin insert into public.review_likes (log_id, user_id) values (log1, u2); r := r || ' | ok: like allowed';
exception when others then r := r || ' | FAIL: like blocked ' || sqlerrm; end;
begin insert into public.review_likes (log_id, user_id) values (log1, u2); r := r || ' | FAIL: double like allowed';
exception when unique_violation then r := r || ' | ok: double like blocked'; when others then r := r || ' | FAIL: double like odd error ' || sqlstate; end;
begin insert into public.review_likes (log_id, user_id) values (log1, u1); r := r || ' | FAIL: liked as someone else';
exception when others then r := r || ' | ok: like as someone else blocked ' || sqlstate; end;
begin insert into public.review_likes (log_id, user_id, created_at) values (log1, u2, now() - interval '1 year'); r := r || ' | FAIL: client set created_at';
exception when others then r := r || ' | ok: setting created_at blocked ' || sqlstate; end;
begin insert into public.review_comments (log_id, user_id, body) values (log1, u2, 'nice review') returning id into cid; r := r || ' | ok: comment allowed';
exception when others then r := r || ' | FAIL: comment blocked ' || sqlerrm; end;
begin insert into public.review_comments (log_id, user_id, body) values (log1, u2, repeat('x', 1001)); r := r || ' | FAIL: 1001-char comment allowed';
exception when check_violation then r := r || ' | ok: long comment blocked'; when others then r := r || ' | FAIL: long comment odd error ' || sqlstate; end;
begin insert into public.review_comments (log_id, user_id, body) values (log1, u2, '   '); r := r || ' | FAIL: blank comment allowed';
exception when check_violation then r := r || ' | ok: blank comment blocked'; when others then r := r || ' | FAIL: blank comment odd error ' || sqlstate; end;
begin insert into public.review_comments (log_id, user_id, body) values (log1, u1, 'pretending'); r := r || ' | FAIL: commented as someone else';
exception when others then r := r || ' | ok: comment as someone else blocked ' || sqlstate; end;
begin update public.review_comments set body = 'edited' where id = cid; r := r || ' | FAIL: comment edit allowed';
exception when others then r := r || ' | ok: comment edit blocked ' || sqlstate; end;
select * into rec from public.review_engagement(array[log1]);
r := r || ' | ' || case when rec.likes = 1 and rec.comments = 1 and rec.liked_by_me then 'ok' else 'FAIL' end || ': engagement for liker = ' || rec.likes || '/' || rec.comments || '/' || rec.liked_by_me;
begin perform public.bump_igdb_rate('rl:dryrun:2', 60); r := r || ' | FAIL: client called rate counter';
exception when others then r := r || ' | ok: rate counter blocked for clients ' || sqlstate; end;
begin
  for i in 1..9 loop insert into public.review_comments (log_id, user_id, body) values (log1, u2, 'flood ' || i); end loop;
  r := r || ' | ok: 10 comments in a minute allowed';
exception when others then r := r || ' | FAIL: flood brake too early ' || sqlerrm; end;
begin insert into public.review_comments (log_id, user_id, body) values (log1, u2, 'flood 11'); r := r || ' | FAIL: 11th comment allowed';
exception when others then r := r || ' | ok: 11th comment blocked ' || sqlstate; end;
perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
begin insert into public.review_likes (log_id, user_id) values (log1, u1); r := r || ' | FAIL: self-like allowed';
exception when others then r := r || ' | ok: self-like blocked ' || sqlstate; end;
delete from public.review_comments where id = cid; get diagnostics n = row_count;
r := r || ' | ' || case when n = 0 then 'ok' else 'FAIL' end || ': deleting another person''s comment removed ' || n;
delete from public.review_likes where log_id = log1 and user_id = u2; get diagnostics n = row_count;
r := r || ' | ' || case when n = 0 then 'ok' else 'FAIL' end || ': deleting another person''s like removed ' || n;
n := public.unseen_review_notification_count();
r := r || ' | ' || case when n = 11 then 'ok' else 'FAIL' end || ': owner unseen count = ' || n;
select count(*) into n from public.review_notifications(30) where unseen;
r := r || ' | ' || case when n = 11 then 'ok' else 'FAIL' end || ': owner notification rows = ' || n;
perform public.mark_review_notifications_seen();
n := public.unseen_review_notification_count();
r := r || ' | ' || case when n = 0 then 'ok' else 'FAIL' end || ': unseen after marking seen = ' || n;
select count(*) into n from public.notification_reads;
r := r || ' | ' || case when n = 1 then 'ok' else 'FAIL' end || ': owner sees only own marker (' || n || ')';
begin insert into public.review_comments (log_id, user_id, body) values (log1, u1, 'thanks'); r := r || ' | ok: owner can reply on own log';
exception when others then r := r || ' | FAIL: owner reply blocked ' || sqlerrm; end;
perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
select count(*) into n from public.notification_reads;
r := r || ' | ' || case when n = 0 then 'ok' else 'FAIL' end || ': other user cannot see owner marker (' || n || ')';
n := public.unseen_review_notification_count();
r := r || ' | ' || case when n = 0 then 'ok' else 'FAIL' end || ': liker gets no notifications for own actions (' || n || ')';
execute 'reset role';
perform set_config('request.jwt.claims', '{"role":"anon"}', true);
execute 'set local role anon';
select * into rec from public.review_engagement(array[log1]);
r := r || ' | ' || case when rec.likes = 1 and rec.comments = 11 and not rec.liked_by_me then 'ok' else 'FAIL' end || ': engagement for visitor = ' || rec.likes || '/' || rec.comments || '/' || rec.liked_by_me;
begin insert into public.review_likes (log_id, user_id) values (log1, u2); r := r || ' | FAIL: visitor liked';
exception when others then r := r || ' | ok: visitor like blocked ' || sqlstate; end;
begin insert into public.review_comments (log_id, user_id, body) values (log1, u2, 'anon'); r := r || ' | FAIL: visitor commented';
exception when others then r := r || ' | ok: visitor comment blocked ' || sqlstate; end;
begin n := public.unseen_review_notification_count(); r := r || ' | FAIL: visitor called notification count';
exception when others then r := r || ' | ok: visitor notification count blocked ' || sqlstate; end;
execute 'reset role';
perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
execute 'set local role authenticated';
delete from public.review_comments where user_id = u2; get diagnostics n = row_count;
r := r || ' | ' || case when n = 10 then 'ok' else 'FAIL' end || ': author deleted own comments (' || n || ')';
delete from public.review_likes where log_id = log1 and user_id = u2; get diagnostics n = row_count;
r := r || ' | ' || case when n = 1 then 'ok' else 'FAIL' end || ': author removed own like (' || n || ')';
execute 'reset role';
raise exception 'DRY RUN, ROLLED BACK%', r;
end
$dry$;
