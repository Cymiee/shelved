# Shelved: where things stand and what's next

Last updated: 11 November 2026.

Goal: a full-fledged site that is fun to use, secure, and can earn a little money.

## State of the code

- **Committed** (`c07c7d0 major rehaul`): the "game shop" redesign. Navy pegboard wall, covers on shelf planks, spine shelves, sticker ratings, paper review cards, new home hero, shelf page with sort/view toggle and next-game picker, log modal as a bottom sheet on phones.
- **Uncommitted in the working tree (34 files)**: everything below under "Built, not committed". `npm run typecheck` and `npm run build --workspace=web` both pass. Nothing is committed or deployed.

### Built, not committed

| Area | What changed | Main files |
|---|---|---|
| Friends | Top-level destination (desktop nav, mobile bottom bar, request badge). Live search by username, accept, decline, cancel, remove, copy profile link. Screen updates before the server answers. | `web/src/pages/FriendsPage.tsx`, `web/src/components/FriendsView.tsx` |
| Wishlist | Covers on shelves, one-tap "Start playing", sorting, "Not out yet" sticker, next-game picker. | `web/src/pages/WantToPlayPage.tsx`, `web/src/components/WishlistView.tsx`, `web/src/components/NextGamePick.tsx` |
| Search | Results as you type in the navbar, `/` shortcut, log straight from a result. | `web/src/components/NavSearch.tsx` |
| Stats | `/stats`: a till receipt of your shelf (totals, rating histogram, top genres) plus most played and highest rated shelves. Linked from My shelf and the avatar menu. | `web/src/pages/StatsPage.tsx`, `web/src/components/StatsReceipt.tsx`, `web/src/lib/stats.ts` |
| Friends feed | `/feed`: full feed with "Show more"; Home links to it with "See all". | `web/src/pages/FeedPage.tsx`, `web/src/hooks/useFriendsFeed.ts` |
| Stability | Error screen instead of a blank app on a crash; pages load on demand. | `web/src/components/ErrorBoundary.tsx`, `web/src/App.tsx` |
| Install and previews | Web manifest, icons, link-preview image and tags. | `web/public/`, `web/index.html` |
| Security (repo side) | Hardened edge functions, security headers, safe id handling in friend queries. | `supabase/functions/*`, `vercel.json`, `lib/src/supabase/friends.ts` |
| Navigation | Profile moved into the avatar menu; Friends took its place. | `web/src/components/Navbar.tsx`, `web/src/components/BottomNav.tsx` |

## Waiting on you

These are not live. The first one matters most.

1. **Apply the database migration** `supabase/migrations/20240101000014_harden_policies.sql`.
   - What it closes: any signed-in user can currently set their Steam ID to someone else's, and can insert an already-accepted friendship with anyone. Both were confirmed against the live database's policies.
   - It has never been run. Two attempts through Claude were declined at the approval prompt.
   - How: paste the file into the Supabase SQL editor and run it, or approve the prompt next time Claude applies it. Do **not** use `supabase db push`: the local migration filenames use placeholder dates that don't match the remote history, so it may try to re-apply old ones.
   - After applying, test in the app: edit your bio, unlink and relink Steam, send and accept a friend request.
2. **Deploy the three edge functions** (changes are in the repo only, syntax-checked, never run):
   - `supabase functions deploy igdb-proxy`
   - `supabase functions deploy steam-sync`
   - `supabase functions deploy steam-auth --no-verify-jwt` (it is deployed without JWT verification today, because Steam calls it back)
   - Then test Steam linking once; the callback now checks more of Steam's response.
3. **Turn on leaked-password protection** in Supabase, under Authentication settings. Supabase's own security advisor flags it as off.
4. **Production domain.** `og:image` in `web/index.html` is `/og-image.png`; most sites need an absolute URL. Replace it with `https://<your-domain>/og-image.png` and add an `og:url` tag.
5. **Commit.** Review the diff, then commit. Pushing to `main` deploys to Vercel, so consider a branch and a preview deploy first: `vercel.json` now sends a Content-Security-Policy, tested locally against the production build but not on Vercel itself.

## Not yet tested with a real signed-in account

Checked only with sample data or as a signed-out visitor: friend actions against the real database, wishlist actions, the Home "Your shelf" strip, `/shelf` picker, `/feed` with real items, `/stats` for your own account (checked using a public profile's data), the mobile Log button flow, logging from search results. Click through these once signed in.

## Next up, in order

1. **Share your shelf.** A public stats or shelf link with a generated preview image, so a shared link shows that person's spines. This is how the site spreads. Needs a server-rendered image (Vercel function), so decide on that first.
2. **Remaining layout passes:** Settings, List page, Onboarding. They have the new colours and type but the old layouts.
3. **Game page:** screenshots or artwork gallery, and the "Where to buy" block (see Money).
4. **Home error states.** Failed requests on Home are swallowed, so a broken shelf looks empty.
5. **Likes and comments on reviews.** Biggest social gap. Needs new tables, so it needs your sign-off on the schema.
6. **Tests.** There are none. Start with `web/src/lib/stats.ts` (pure function) and the lib query functions.

## Money

Nothing is built. Options, best fit first:

1. **Affiliate "Where to buy" links on game pages.** Costs users nothing. You need to join the affiliate programmes first (for example Amazon Associates, Humble Partner, Fanatical, GOG via a network). Then the block is a small build: store links per game with your tags.
2. **Supporter tier.** Cosmetic perks (shelf themes, sticker packs) for a small monthly fee. Needs a payment provider and schema changes.
3. **Ads.** Not recommended: little income at this size and it undercuts the feel of the site.

## Known security leftovers

- The game-data proxy has no rate limiting; anyone with the public key can call it. Endpoints are now allow-listed, which limits the damage.
- Steam linking is tied to the account that started it, not the browser. Someone could trick another person into linking their Steam account to the attacker's Shelved account. Low impact (the library must already be public).
- Avatars can point at any https URL, which lets a profile owner see visitors' IP addresses.
- Activity rows are written by the browser, so a user can post activity that doesn't match their logs.
- No size limit yet on list titles and descriptions (bio, username and reviews are covered by the migration).

## Working notes

- Design system lives in `web/src/styles/tokens.css` (colours, radii, type) and `web/src/index.css` (planks, stickers, paper, spines, buttons, receipt). Paper is reserved for things people wrote or own.
- Pages that need a login are split into a container (`pages/X.tsx`, data and actions) and a pure view (`components/XView.tsx`). To check a view without signing in, render it from a temporary route with sample data, then delete the route.
- To check phone layouts in desktop Chrome (the window won't go narrower than about 500px), load the page in a 375px-wide iframe.
- Run: `npm run dev` (web on Vite), `npm run typecheck`, `npm run build --workspace=web`.
- `ErrorBoundary` is the one class component; React has no hook equivalent.
