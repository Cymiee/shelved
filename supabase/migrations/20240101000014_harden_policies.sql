-- Security hardening. Closes holes where the row-level rules allowed more than
-- the app ever does. Nothing here changes what the app itself can do.
--
-- Client requests reach Postgres as the `authenticated` or `anon` role; the
-- edge functions use the service role. The guards below key off that.

-- ── users: Steam columns are set by the steam-auth function only ────────────
-- Before: "own profile update" let a signed-in user PATCH any column of their
-- own row, so anyone could set steam_id to someone else's SteamID, import
-- that person's library as their own, and (steam_id is unique) block the real
-- owner from ever linking. Clients may still CLEAR the link (unlink).
create or replace function public.guard_user_steam_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only requests made with a browser key are restricted.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.steam_id := null;
    new.steam_synced_at := null;
    return new;
  end if;

  if new.steam_id is distinct from old.steam_id and new.steam_id is not null then
    raise exception 'steam_id can only be set by linking through Steam';
  end if;
  if new.steam_synced_at is distinct from old.steam_synced_at and new.steam_synced_at is not null then
    raise exception 'steam_synced_at is set by the server';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_user_steam_columns on public.users;
create trigger guard_user_steam_columns
  before insert or update on public.users
  for each row execute function public.guard_user_steam_columns();

-- A steamID64 is exactly 17 digits. Existing rows are left alone (NOT VALID);
-- every new or changed value is checked.
alter table public.users
  add constraint users_steam_id_format check (steam_id is null or steam_id ~ '^[0-9]{17}$') not valid;

-- Make the owner pin on updates explicit rather than inherited from USING.
drop policy "own profile update" on public.users;
create policy "own profile update" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ── friendships: a request starts pending, and only its status can change ───
-- Before: the insert rule only checked who the requester was, so a user could
-- insert a row already marked 'accepted' and become anyone's friend without
-- consent. The addressee could also rewrite requester_id on a row they
-- received, forging a friendship with a third person.
drop policy "requester can insert" on public.friendships;
create policy "requester can insert" on public.friendships
  for insert with check (auth.uid() = requester_id and status = 'pending');

drop policy "addressee can update" on public.friendships;
create policy "addressee can update" on public.friendships
  for update using (auth.uid() = addressee_id) with check (auth.uid() = addressee_id);

-- Column-level: accepting is the only edit a client ever makes.
revoke update on public.friendships from authenticated, anon;
grant update (status) on public.friendships to authenticated;

-- ── igdb_cache: the prune function is for the proxy only ────────────────────
revoke execute on function public.prune_igdb_cache() from public, anon, authenticated;
grant execute on function public.prune_igdb_cache() to service_role;

-- ── Size limits on free text ────────────────────────────────────────────────
-- Nothing capped these, so one request could store megabytes in a bio or a
-- review that every visitor then downloads. NOT VALID: applies to new and
-- edited rows without failing on anything already stored.
alter table public.users
  add constraint users_username_length check (char_length(username) between 1 and 64) not valid,
  add constraint users_bio_length check (bio is null or char_length(bio) <= 1000) not valid,
  add constraint users_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 2000) not valid;

alter table public.game_logs
  add constraint game_logs_review_length check (review is null or char_length(review) <= 10000) not valid;

-- ── Pin search_path on the remaining functions (Supabase security advisor) ──
alter function public.set_updated_at() set search_path = public;
alter function public.import_steam_logs() set search_path = public;
