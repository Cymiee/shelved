# Shelved: where things stand and what's next

Last updated: 16 November 2026.

Goal: a full-fledged site that is fun to use, secure, and can earn a little money.

## State (checked 16 Nov)

- **Live:** `5cc06b4` (Stages 1 to 6) is pushed and deploys from GitHub to https://shelved-one.vercel.app/.
- **Database:** all migrations through `20240101000016` are applied. The likes and comments rules were tested first with `supabase/tests/20240101000015_dry_run.sql` (30 of 30 checks ok), then applied on 16 Nov and verified: row-level security on all three new tables, visitors can read counts but not notifications, only the edge function can call the rate counter.
- **Edge functions:** `igdb-proxy` v12 is live without rate limiting. The rate-limited version is in the repo and needs deploying (step 1 below).

## Waiting on you, in this order

1. **Deploy the proxy:** `supabase functions deploy igdb-proxy`.
2. **Check on the live site, signed in with two accounts:** like and unlike, comment, delete a comment, the bell count and the notifications page.
3. **Leaked-password protection** needs the Supabase Pro plan (Authentication > Providers > Email).
4. **Affiliates:** finish Amazon Associates (Store ID, "Content or Niche Website"), then set `VITE_AMAZON_TAG` and `VITE_AMAZON_DOMAIN` in Vercel and redeploy. Fanatical (Awin) and Humble (Impact) as described below.

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

1. **Per-profile link previews** (step B of sharing): a server function that returns profile-specific preview tags and image, so a shared profile link shows that person's shelf. Needs a Vercel function and an image library: your call.
2. **Supporter tier:** cosmetic perks (shelf themes, sticker packs) for a small monthly fee. Needs a payment provider and schema changes.
3. **Known security leftovers:** avatars can point at any https URL (lets a profile owner see visitors' IP addresses); activity rows are written by the browser; list titles and descriptions have no length limit; Steam linking is tied to the account that started it, not the browser.

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
