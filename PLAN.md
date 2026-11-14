# Shelved: where things stand and what's next

Last updated: 14 November 2026.

Goal: a full-fledged site that is fun to use, secure, and can earn a little money.

## State (checked 14 Nov)

- **Live:** commit `fd5b877` at https://shelved-one.vercel.app/.
- **Committed locally, not pushed:** `5cc06b4` (Stages 1 to 6, including likes, comments and notifications). Pushing failed from Claude's environment: `git@github.com: Permission denied (publickey)`. Run `git push origin main` from a machine with GitHub access. Vercel deploys on push.
- **Database:** the security migration (`...014`) is applied. The two new migrations are **not**:
  - `20240101000015_review_likes_comments.sql`: likes, comments, notification markers and their functions.
  - `20240101000016_igdb_rate_limit.sql`: the shared rate-limit counter for the game-data proxy.
- **Edge functions:** `igdb-proxy` v12 is live without rate limiting; the rate-limited version is in the repo only.

Until migration 015 is applied, the like and comment buttons simply don't appear (the cards hide them when counts can't load), and the notification badge counts friend requests only. Nothing breaks.

## Waiting on you, in this order

1. **Push:** `git push origin main`.
2. **Test the new migrations:** paste `supabase/tests/20240101000015_dry_run.sql` into the Supabase SQL editor and run it. It must end in an error starting `DRY RUN, ROLLED BACK` with only `ok:` entries (30 checks covering who can like, comment, delete and see notifications). Any `FAIL:` means stop. Running it through Claude was declined at the approval prompt twice, so it has never run.
3. **Apply:** run `supabase/migrations/20240101000015_review_likes_comments.sql`, then `...016_igdb_rate_limit.sql`, in the SQL editor.
4. **Deploy the proxy (after step 3):** `supabase functions deploy igdb-proxy`.
5. **Check on the live site, signed in with two accounts:** like and unlike, comment, delete a comment, the bell count and the notifications page.
6. **Leaked-password protection** needs the Supabase Pro plan (Authentication > Providers > Email).
7. **Affiliates:** finish Amazon Associates (Store ID, "Content or Niche Website"), then set `VITE_AMAZON_TAG` and `VITE_AMAZON_DOMAIN` in Vercel and redeploy. Fanatical (Awin) and Humble (Impact) as described below.

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
- Database migrations: the owner runs them in the Supabase SQL editor. Don't use `supabase db push`; local filenames use placeholder dates that don't match the remote history.
- `ErrorBoundary` is the one class component; React has no hook equivalent.
- Only `App.tsx` and `SettingsPage.tsx` may call `supabase.auth` directly (CLAUDE.md); settings sections get auth actions passed in as props.
