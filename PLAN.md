# Shelved: where things stand and what's next

Last updated: 12 November 2026.

Goal: a full-fledged site that is fun to use, secure, and can earn a little money.

## State (checked 12 Nov)

- **Live:** everything up to commit `fd5b877` is deployed at https://shelved-one.vercel.app/.
- **Database:** the security migration `20240101000014_harden_policies.sql` is applied (verified: Steam guard trigger present, friendship rules tightened, length limits on, prune function locked).
- **Edge functions:** the hardened versions are deployed (`igdb-proxy` v12, `steam-auth` v5, `steam-sync` v5).
- **Uncommitted in the working tree:** the Stage 1 to 4 and 6 work below. `npm run typecheck`, `npm test` (47 tests) and `npm run build --workspace=web` all pass.

## Done today, not yet committed

| Stage | What | Built by | Checked how |
|---|---|---|---|
| 1 | Home shelves show "Couldn't load … Try again" instead of vanishing when a request fails | Sonnet | Code review, typecheck |
| 2 | Game page: screenshot gallery with a full-screen viewer; "Where to buy" with official store links; affiliate shops that switch on from Vercel settings | Opus | Screenshots desktop and 375px, 7 unit tests |
| 3 | List page and onboarding restyled | Sonnet | Onboarding screenshot at 375px |
| 3 | Settings rebuilt: Profile, Taste, Steam, Password sections, each saving on its own; length limits match the database; unlink asks first | Opus | Screenshots desktop and 375px (no saves) |
| 4 | Stats page "Share receipt": draws the receipt as an image and opens the phone's share sheet (downloads it on desktop) | Opus | Rendered image checked |
| 6 | Vitest added (dev only), 47 tests, `npm test` in CI | Sonnet | Tests pass; build output has no test code |
| 6 | Profile page split from 880 to 372 lines; favourite remove button works on touch | Sonnet | Screenshot at 375px |
| – | Link previews use the real domain | Opus | – |

Not tested with a real signed-in account: saving in Settings, Steam sync and unlink, list editing, onboarding save, the share sheet on a phone, and everything listed as untested in earlier sessions (friends, wishlist, feed, mobile Log button).

## Waiting on you

1. **Commit and push** the working tree. Then click through the untested list above on the live site.
2. **Leaked-password protection** needs the Supabase Pro plan. On the free plan the toggle is unavailable. If you upgrade: Authentication > Providers > Email > "Prevent use of leaked passwords". While there, consider raising the minimum password length to 8; the app's own checks are at 6 and would then be raised to match.
3. **Affiliate sign-ups**, then add the values in Vercel (Project > Settings > Environment Variables) and redeploy. Shops only appear once their value is set.
   - `VITE_AMAZON_TAG` (your Associates tracking ID) and `VITE_AMAZON_DOMAIN` (the store you joined, e.g. `amazon.in`, `amazon.com`, `amazon.co.uk`).
   - `VITE_AFFILIATE_FANATICAL_TEMPLATE`: Fanatical runs through Awin. Format: `https://www.awin1.com/cread.php?awinmid=<Fanatical's merchant id>&awinaffid=<your publisher id>&ued={url}`.
   - `VITE_AFFILIATE_HUMBLE_TEMPLATE`: Humble runs through Impact. Make a tracking link in Impact, then replace the destination part (the value after `u=`) with `{url}`.

## Next: Stage 5, likes and comments (left for Fable 5.2)

Left for Fable because it adds tables and access rules to the live database, where a mistake leaks or corrupts user data. The prompt to use, as written:

> Read PLAN.md and CLAUDE.md. Build Stage 5: likes and comments on reviews, which I've approved. Proposed schema: `review_likes (log_id, user_id, created_at)` with one like per person per review, and `review_comments (id, log_id, user_id, body, created_at)` with a length limit; anyone can read, only the author can write or delete their own. Show like and comment counts on every review and activity paper card, with comments opening inline under the card. Count likes and comments on my reviews in the notification badge. Write the migration file, test the row-level security policies in a rolled-back transaction against the live database before applying, and give me the file to run in the SQL editor if applying is declined. Use Sonnet agents for the mechanical UI parts. Then, as a second task, add per-IP rate limiting to the `igdb-proxy` edge function using the existing cache table, and tell me the deploy command. Update PLAN.md when done.

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
