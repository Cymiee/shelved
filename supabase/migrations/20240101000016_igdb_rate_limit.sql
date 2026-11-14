-- Per-caller request counter for the igdb-proxy edge function, kept in the
-- existing igdb_cache table under keys like 'rl:<hashed ip>:<minute>'.
--
-- One atomic statement: insert the counter at 1, or add 1 to it. A plain
-- read-then-write from the function would lose counts when requests overlap.
-- Rows carry an expiry, so the existing prune_igdb_cache() clears them.
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

-- Only the edge function (service role) may call it.
revoke execute on function public.bump_igdb_rate(text, integer) from public, anon, authenticated;
grant execute on function public.bump_igdb_rate(text, integer) to service_role;
