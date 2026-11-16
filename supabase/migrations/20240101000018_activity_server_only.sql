-- Security leftovers, step 2 of 2. Apply only after the site version that no
-- longer inserts activity from the browser is live (commit that removed the
-- inserts from lib/src/supabase/games.ts). Applying it earlier makes logging a
-- game fail on the old site.
--
-- From here on only the database triggers (migration 017) write activity.
drop policy "own activity insert" on public.activity;
revoke insert, update, delete on public.activity from anon, authenticated;
