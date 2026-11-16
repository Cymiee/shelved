# Shelved: where things stand and what's next

Last updated: 16 November 2026 (evening).

Goal: a full-fledged site that is fun to use, secure, and can earn a little money.

## State (checked 16 Nov, evening)

- **Built, committed locally, not live:** security leftovers (database-written activity, avatar image hosts, list limits, tighter image policy) and per-profile share previews (`api/share.ts`, a Vercel function using `@vercel/og` 0.11.1; 1.0.x crashes in Node on a missing `hb.wasm`). Migrations `017` and `018` are written and tested only by reading: the rollback-only test was declined at the approval prompt, so run it yourself (below).
- **Live:** `5cc06b4` (Stages 1 to 6) is pushed and deploys from GitHub to https://shelved-one.vercel.app/.
- **Database:** all migrations through `20240101000016` are applied. The likes and comments rules were tested first with `supabase/tests/20240101000015_dry_run.sql` (30 of 30 checks ok), then applied on 16 Nov and verified: row-level security on all three new tables, visitors can read counts but not notifications, only the edge function can call the rate counter.
- **Edge functions:** `igdb-proxy` v13 (rate limited, 180 requests a minute per address) deployed 16 Nov and smoke-tested: game queries work, cache hits work, unknown endpoints are refused, the shared counter counts. Deployed through the Supabase connector; it needs `import_map_path: "deno.json"` set explicitly or the upload fails.

## Waiting on you, in this order

The security fixes have to go out in this order, because the live site still writes activity rows from the browser:

1. **Test:** run `supabase/tests/20240101000017_dry_run.sql` in the Supabase SQL editor. It must end in `DRY RUN, ROLLED BACK` with only `ok:` entries.
2. **Apply `20240101000017_server_written_activity.sql`.** Safe with the current live site: the database starts writing activity itself (old browser writes just duplicate, and the feed already collapses repeats), avatar links are limited to known image hosts, and lists get length limits.
3. **Push** (`git push origin main`). The new site stops writing activity from the browser, checks avatar links before saving, and adds share previews.
4. **After Vercel shows the deploy live, apply `20240101000018_activity_server_only.sql`.** Applying it before the new site is live breaks logging games on the old one.
5. **Check share previews:** paste a profile link into Discord, WhatsApp or X; it should show that person's name, stats and favourite covers. Or run `curl -A "Discordbot" https://shelved-one.vercel.app/profile/<id>`, which should return a short page whose `og:image` points at `/api/share?...&image=1`.
6. **Check on the live site, signed in with two accounts:** like and unlike, comment, delete a comment, the bell count and the notifications page.
7. **Leaked-password protection** needs the Supabase Pro plan (Authentication > Providers > Email).
8. **Affiliates:**
   - Amazon: done. Set `VITE_AMAZON_TAG` (your Store ID, ending in `-20`/`-21`) and `VITE_AMAZON_DOMAIN` (the store you joined, e.g. `amazon.in`) in Vercel, then redeploy.
   - Fanatical: sign up through Awin (fanatical.com/en/affiliates > Join our programme). Step 1 needs your legal name, tax residency, email and a password. Once approved, set `VITE_AFFILIATE_FANATICAL_TEMPLATE`.
   - Humble: humblebundle.com/partner, which hands over to Impact. Claude's browser extension can't open humblebundle.com (not on its allowed list). Once approved, set `VITE_AFFILIATE_HUMBLE_TEMPLATE`.

### Affiliate values for Vercel

- `VITE_AFFILIATE_FANATICAL_TEMPLATE`: `https://www.awin1.com/cread.php?awinmid=<Fanatical's merchant id>&awinaffid=<your publisher id>&ued={url}`.
- `VITE_AFFILIATE_HUMBLE_TEMPLATE`: make a tracking link in Impact, then replace the destination after `u=` with `{url}`.

## Built (all in `5cc06b4`)

| Stage | What |
|---|---|
| 1 | Home shelves show "Couldn't load … Try again" instead of vanishing |
| 2 | Game page screenshot gallery and "Where to buy" (official stores now, affiliate shops once configured) |
| 3 | List, onboarding and Settings restyled; Settings split into four independently saving sections |
| 4 | "Share receipt" on Stats: an image for the phone share sheet |
| 5 | Likes and comments on review and activity cards, inline threads, `/notifications` page and navbar bell, proxy rate limiting |
| 6 | Vitest, 47 tests, CI runs them; Profile page split up |

Not tested with a real signed-in account yet: anything that writes (settings saves, Steam sync, list editing, likes, comments, friends, wishlist actions) and the phone share sheet.

## After that

1. **Share previews for lists and games**, using the same `api/share.ts` approach.
2. **Supporter tier:** cosmetic perks (shelf themes, sticker packs) for a small monthly fee. Needs a payment provider and schema changes.
3. **Known security leftovers (after 017/018):** Steam linking is tied to the account that started it, not the browser (low impact).

## Money

1. **Affiliate links** are built (Stage 2) and switch on per shop from Vercel settings. Expect small, occasional commissions at this size.
2. **Supporter tier** later.
3. **Ads:** not recommended.

## Working notes

- Design system: `web/src/styles/tokens.css` (colours, radii, type) and `web/src/index.css` (planks, stickers, paper, spines, buttons, receipt). Paper is reserved for things people wrote or own.
- Pages that need a login are split into a container (`pages/X.tsx`) and a view (`components/...`). To check a view without signing in, render it from a temporary route with sample data, then delete the route.
- Phone layouts: headless Chrome's window can't go below about 500px. A small driver script that sets the viewport through Chrome's debugging protocol gives a true 375px view and reports horizontal overflow.
- Run: `npm run dev`, `npm run typecheck`, `npm test`, `npm run build --workspace=web`.
- Database migrations: write a rollback-only dry-run script first (see `supabase/tests/`), have it run in the SQL editor, then apply. Claude can apply through the Supabase connector when the owner asks. Don't use `supabase db push`; local filenames use placeholder dates that don't match the remote history.
- `ErrorBoundary` is the one class component; React has no hook equivalent.
- Only `App.tsx` and `SettingsPage.tsx` may call `supabase.auth` directly (CLAUDE.md); settings sections get auth actions passed in as props.
