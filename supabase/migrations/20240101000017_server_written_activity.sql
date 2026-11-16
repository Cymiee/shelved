-- Security leftovers, step 1 of 2. Safe to apply while the old site is live.
--
-- 1. Activity is written by the database, not the browser.
--    Before: the browser inserted activity rows itself, so anyone could post
--    "reviewed X, 10/10" for a game they never logged. Now triggers on
--    game_logs and top_games write activity from what was actually saved.
--    Step 2 (migration 018) removes the browser's insert right once the site
--    no longer uses it. Until then the old site's own inserts duplicate the
--    trigger's rows; the feed already collapses repeats of the same game.
-- 2. Avatar images may only come from a short list of image hosts.
--    Before: any https URL, which let a profile owner log the IP address of
--    everyone who viewed their profile.
-- 3. Lists get length limits, and clients can no longer set a list's like
--    count, owner, id or timestamps directly.

-- ── 1. Activity from the database ────────────────────────────────────────────
create or replace function public.log_activity_from_game_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  review_text text := nullif(btrim(coalesce(new.review, '')), '');
begin
  -- Bulk imports (Steam sync) set this so a library import doesn't flood friends' feeds.
  if current_setting('shelved.skip_activity', true) = 'on' then
    return new;
  end if;
  -- Only something a friend would care about: status, rating or review changed.
  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and new.rating is not distinct from old.rating
     and new.review is not distinct from old.review then
    return new;
  end if;

  insert into public.activity (user_id, type, game_igdb_id, metadata)
  values (
    new.user_id,
    case when review_text is not null then 'reviewed'::activity_type
         when new.rating is not null then 'rated'::activity_type
         else 'logged'::activity_type end,
    new.game_igdb_id,
    jsonb_build_object('status', new.status, 'rating', new.rating, 'review', review_text)
  );
  return new;
end;
$$;

create trigger log_activity
  after insert or update on public.game_logs
  for each row execute function public.log_activity_from_game_log();

create or replace function public.log_activity_from_top_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.game_igdb_id is not distinct from old.game_igdb_id then
    return new;
  end if;
  insert into public.activity (user_id, type, game_igdb_id, metadata)
  values (new.user_id, 'topped', new.game_igdb_id, jsonb_build_object('position', new.position));
  return new;
end;
$$;

create trigger log_activity
  after insert or update on public.top_games
  for each row execute function public.log_activity_from_top_game();

-- Trigger functions are not for calling directly.
revoke execute on function public.log_activity_from_game_log() from public, anon, authenticated;
revoke execute on function public.log_activity_from_top_game() from public, anon, authenticated;

-- Steam import: unchanged except that it switches activity off for its own
-- transaction, so importing 100 games doesn't post 100 feed items.
create or replace function public.import_steam_logs()
returns json
language plpgsql
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_ins int;
  v_upd int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  perform set_config('shelved.skip_activity', 'on', true);

  insert into public.game_logs (user_id, game_igdb_id, status, playtime_min)
  select sl.user_id, sl.game_igdb_id, 'played'::game_status, sl.playtime_min
  from public.steam_library sl
  where sl.user_id = v_uid
    and sl.game_igdb_id is not null
    and sl.playtime_min > 0
    and not exists (
      select 1 from public.game_logs gl
      where gl.user_id = v_uid and gl.game_igdb_id = sl.game_igdb_id
    )
  on conflict (user_id, game_igdb_id) do nothing;
  get diagnostics v_ins = row_count;

  update public.game_logs gl
  set playtime_min = sl.playtime_min, updated_at = now()
  from public.steam_library sl
  where sl.user_id = v_uid and gl.user_id = v_uid
    and sl.game_igdb_id = gl.game_igdb_id
    and sl.playtime_min > 0
    and gl.playtime_manual = false
    and gl.playtime_min is distinct from sl.playtime_min;
  get diagnostics v_upd = row_count;

  perform set_config('shelved.skip_activity', 'off', true);

  return json_build_object('imported', v_ins, 'updated', v_upd);
end;
$function$;

-- ── 2. Avatar images from known image hosts only ─────────────────────────────
-- A preset ("preset:<id>"), nothing, or an https image on one of these hosts.
-- Every current user has a preset, so the rule can be checked immediately.
alter table public.users
  add constraint users_avatar_url_host check (
    avatar_url is null
    or avatar_url ~ '^preset:[a-z0-9_-]{1,40}$'
    or (
      -- Postgres regexes can't repeat more than 255 times, so the length limit is separate.
      avatar_url ~ '^https://(i\.imgur\.com|avatars\.githubusercontent\.com|cdn\.discordapp\.com|avatars\.steamstatic\.com|secure\.gravatar\.com|lh3\.googleusercontent\.com|pbs\.twimg\.com)/[^\s]+$'
      and char_length(avatar_url) <= 2000
    )
  );

-- ── 3. Lists ─────────────────────────────────────────────────────────────────
alter table public.lists
  add constraint lists_title_length check (char_length(btrim(title)) between 1 and 100),
  add constraint lists_description_length check (description is null or char_length(description) <= 1000);

revoke insert, update on public.lists from anon, authenticated;
grant insert (user_id, title, description) on public.lists to authenticated;
grant update (title, description) on public.lists to authenticated;

drop policy "own lists update" on public.lists;
create policy "own lists update" on public.lists
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
