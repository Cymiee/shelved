-- DRY RUN for migrations 20240101000017 and 20240101000018. Changes nothing.
--
-- Paste the whole file into the Supabase SQL editor and run it BEFORE either
-- migration. It applies both inside one transaction, acts as a signed-in user,
-- checks each rule, then deliberately fails so Postgres rolls it all back.
--
-- Expected: an ERROR whose message starts "DRY RUN, ROLLED BACK" followed by
-- only "ok: ..." entries. Any "FAIL: ..." means stop.

do $dry$
declare u1 uuid; lid uuid; n int; before_n int; t text; r text := '';
begin
create or replace function public.log_activity_from_game_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  review_text text := nullif(btrim(coalesce(new.review, '')), '');
begin
  if current_setting('shelved.skip_activity', true) = 'on' then
    return new;
  end if;
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
revoke execute on function public.log_activity_from_game_log() from public, anon, authenticated;
revoke execute on function public.log_activity_from_top_game() from public, anon, authenticated;
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
alter table public.users
  add constraint users_avatar_url_host check (
    avatar_url is null
    or avatar_url ~ '^preset:[a-z0-9_-]{1,40}$'
    or avatar_url ~ '^https://(i\.imgur\.com|avatars\.githubusercontent\.com|cdn\.discordapp\.com|avatars\.steamstatic\.com|secure\.gravatar\.com|lh3\.googleusercontent\.com|pbs\.twimg\.com)/[^\s]{1,1900}$'
  );
alter table public.lists
  add constraint lists_title_length check (char_length(btrim(title)) between 1 and 100),
  add constraint lists_description_length check (description is null or char_length(description) <= 1000);
revoke insert, update on public.lists from anon, authenticated;
grant insert (user_id, title, description) on public.lists to authenticated;
grant update (title, description) on public.lists to authenticated;
drop policy "own lists update" on public.lists;
create policy "own lists update" on public.lists
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy "own activity insert" on public.activity;
revoke insert, update, delete on public.activity from anon, authenticated;

select id into u1 from public.users order by created_at limit 1;
select count(*) into before_n from public.activity where user_id = u1;
-- favourites: replacing slot 3 posts one "topped" item, re-saving the same game posts nothing
delete from public.top_games where user_id = u1 and position = 3;
insert into public.top_games (user_id, position, game_igdb_id) values (u1, 3, 1942);
update public.top_games set game_igdb_id = 1942 where user_id = u1 and position = 3;
select count(*) into n from public.activity where user_id = u1 and type = 'topped' and game_igdb_id = 1942 and created_at = now();
r := r || ' | ' || case when n = 1 then 'ok' else 'FAIL' end || ': favourite posts one item (' || n || ')';
perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
execute 'set local role authenticated';
insert into public.game_logs (user_id, game_igdb_id, status) values (u1, 999999991, 'playing');
select type::text into t from public.activity where user_id = u1 and game_igdb_id = 999999991 order by created_at desc limit 1;
r := r || ' | ' || case when t = 'logged' then 'ok' else 'FAIL' end || ': new log posts "logged" (' || coalesce(t, 'none') || ')';
update public.game_logs set rating = 8 where user_id = u1 and game_igdb_id = 999999991;
update public.game_logs set playtime_min = 120, playtime_manual = true where user_id = u1 and game_igdb_id = 999999991;
update public.game_logs set review = 'great', rating = 9 where user_id = u1 and game_igdb_id = 999999991;
select count(*) into n from public.activity where user_id = u1 and game_igdb_id = 999999991;
r := r || ' | ' || case when n = 3 then 'ok' else 'FAIL' end || ': rating and review post, hours alone do not (' || n || ' items)';
select metadata->>'review' into t from public.activity where user_id = u1 and game_igdb_id = 999999991 and type = 'reviewed';
r := r || ' | ' || case when t = 'great' then 'ok' else 'FAIL' end || ': review text carried into the feed (' || coalesce(t, 'none') || ')';
perform set_config('shelved.skip_activity', 'on', true);
insert into public.game_logs (user_id, game_igdb_id, status) values (u1, 999999992, 'played');
perform set_config('shelved.skip_activity', 'off', true);
select count(*) into n from public.activity where user_id = u1 and game_igdb_id = 999999992;
r := r || ' | ' || case when n = 0 then 'ok' else 'FAIL' end || ': bulk import posts nothing (' || n || ')';
begin insert into public.activity (user_id, type, game_igdb_id, metadata) values (u1, 'reviewed', 1, '{"review":"fake","rating":10}'); r := r || ' | FAIL: browser can still write activity';
exception when others then r := r || ' | ok: browser activity write blocked ' || sqlstate; end;
begin perform public.log_activity_from_game_log(); r := r || ' | FAIL: trigger function callable';
exception when others then r := r || ' | ok: trigger function not callable ' || sqlstate; end;
begin update public.users set avatar_url = 'https://tracker.example/pixel.png' where id = u1; r := r || ' | FAIL: unknown avatar host allowed';
exception when check_violation then r := r || ' | ok: unknown avatar host blocked'; when others then r := r || ' | FAIL: avatar odd error ' || sqlstate; end;
begin update public.users set avatar_url = 'https://i.imgur.com/abc123.png' where id = u1; r := r || ' | ok: imgur avatar allowed';
exception when others then r := r || ' | FAIL: imgur avatar blocked ' || sqlerrm; end;
begin update public.users set avatar_url = 'preset:nova' where id = u1; r := r || ' | ok: preset avatar allowed';
exception when others then r := r || ' | FAIL: preset avatar blocked ' || sqlerrm; end;
begin insert into public.lists (user_id, title) values (u1, 'Cozy games') returning id into lid; r := r || ' | ok: list create allowed';
exception when others then r := r || ' | FAIL: list create blocked ' || sqlerrm; end;
begin insert into public.lists (user_id, title, likes) values (u1, 'Inflated', 9999); r := r || ' | FAIL: client set likes on create';
exception when others then r := r || ' | ok: setting likes on create blocked ' || sqlstate; end;
begin insert into public.lists (user_id, title) values (u1, repeat('x', 101)); r := r || ' | FAIL: 101-char title allowed';
exception when check_violation then r := r || ' | ok: long title blocked'; when others then r := r || ' | FAIL: long title odd error ' || sqlstate; end;
begin update public.lists set likes = 9999 where id = lid; r := r || ' | FAIL: client set likes';
exception when others then r := r || ' | ok: setting likes blocked ' || sqlstate; end;
begin update public.lists set title = 'Cozy games, renamed', description = 'Short and sweet' where id = lid; r := r || ' | ok: list edit allowed';
exception when others then r := r || ' | FAIL: list edit blocked ' || sqlerrm; end;
begin update public.lists set user_id = gen_random_uuid() where id = lid; r := r || ' | FAIL: list owner changeable';
exception when others then r := r || ' | ok: changing list owner blocked ' || sqlstate; end;
execute 'reset role';
raise exception 'DRY RUN, ROLLED BACK%', r;
end
$dry$;
