# Shelved: where things stand and what's next

Last updated: 16 November 2026 (late evening).

Goal: a full-fledged site that is fun to use, secure, and can earn a little money.

## State (checked 16 Nov, late evening)

- **Live:** everything through the security leftovers and per-profile share previews is pushed and deployed. Verified: the live bundle no longer writes activity from the browser and checks avatar hosts.
- **Share previews broke on deploy** (`ERR_REQUIRE_ESM`: Vercel compiled `api/share.ts` to CommonJS, and `@vercel/og` is ES-module-only). Fixed by `api/package.json` with `"type": "module"`; tested locally as an unbundled ES module (HTML 200, image 200). **Needs a push.**
- **Database:** migrations through `017` applied (017 run by the owner in the SQL editor on 16 Nov after the dry run passed 16/16; verified via connector: both activity triggers, all three new constraints, Steam import skips the feed). The dry run caught a bug first: Postgres regexes can't repeat more than 255 times, so the avatar URL length limit is a separate `char_length` check.
- **`018` not applied yet**, but now safe: the live site no longer inserts activity.
- **Supabase connector:** reads work, but `execute_sql` and `apply_migration` are declined in the 16 Nov session even after the owner allowed them in Claude Code and on claude.ai. Expect a fresh session to pick up the claude.ai setting.
- **Edge functions:** `igdb-proxy` v13 (rate limited, 180 requests a minute per address), deployed 16 Nov. Deploys through the connector need `import_map_path: "deno.json"`.

## Waiting on you, in this order

1. **Apply `20240101000018_activity_server_only.sql`** (safe now; removes the browser's right to write activity).
2. **Push** the share-preview fix (`git push origin main`).
3. **Check share previews:** paste a profile link into Discord, WhatsApp or X; it should show that person's name, stats and favourite covers. Or run `curl -A "Discordbot" https://shelved-one.vercel.app/profile/<id>`, which should return a short page whose `og:image` points at `/api/share?...&image=1`.
4. **Check on the live site, signed in with two accounts:** like and unlike, comment, delete a comment, the bell count and the notifications page.
5. **Leaked-password protection** needs the Supabase Pro plan (Authentication > Providers > Email).
6. **Affiliates** (set in Vercel > Project > Settings > Environment Variables; these are build-time values, so they take effect on the next deploy):
   - **Amazon (approved, Amazon UAE):** `VITE_AMAZON_TAG` = `shelved0d-21`, `VITE_AMAZON_DOMAIN` = `amazon.ae`. **Set in Vercel (Production only) on 16 Nov** and included in the 16 Nov deploy.
   - **Fanatical (applied 16 Nov via Awin; "Fanatical Global" shows under Pending as of 16 Nov; completing the Awin profile helps approval):** Awin publisher ID `3157488`, Fanatical's Awin merchant ID `118821`. You log in to Awin (ui.awin.com), not Fanatical: Advertisers > My Programmes shows Fanatical under Joined once approved. Then set `VITE_AFFILIATE_FANATICAL_TEMPLATE` = `https://www.awin1.com/cread.php?awinmid=118821&awinaffid=3157488&ued={url}`. Don't set it before approval: links for a programme you haven't joined don't earn.
   - **Humble:** skipped; the owner believes the partner programme is discontinued. The code still supports `VITE_AFFILIATE_HUMBLE_TEMPLATE` if it comes back.

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
