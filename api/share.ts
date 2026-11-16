import { ImageResponse } from "@vercel/og";
import type { ReactElement } from "react";

/**
 * Link previews for profiles.
 *
 *   /api/share?u=<user id>          HTML with that profile's title, description
 *                                   and preview image. vercel.json sends link
 *                                   preview bots here instead of the app shell,
 *                                   because bots don't run JavaScript.
 *   /api/share?u=<user id>&image=1  The 1200x630 preview image itself.
 *
 * Reads only public data (profiles and logs are public) with the public anon
 * key, the same access a signed-out visitor has.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WIDTH = 1200;
const HEIGHT = 630;

const COLORS = {
  wall: "#101737",
  card: "#1B2654",
  text: "#F5F6FF",
  soft: "#B5BDE6",
  accent: "#FFD60A",
  onAccent: "#101737",
  accentEdge: "#B38F00",
  plankTop: "#6474C8",
  plank: "#3A4A99",
  plankFront: "#242F6B",
};

interface ShelfSummary {
  username: string;
  games: number;
  average: number | null;
  hours: number;
  covers: { name: string; imageId: string | null }[];
}

// ── Data ─────────────────────────────────────────────────────────────────────

const restHeaders = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };

async function rest<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: restHeaders });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return (await res.json()) as T;
}

async function loadSummary(userId: string): Promise<ShelfSummary | null> {
  const [users, favourites, logs] = await Promise.all([
    rest<{ username: string }[]>(`users?id=eq.${userId}&select=username&limit=1`),
    rest<{ game_igdb_id: number }[]>(`top_games?user_id=eq.${userId}&select=game_igdb_id&order=position`),
    rest<{ game_igdb_id: number; rating: number | null; playtime_min: number | null }[]>(
      `game_logs?user_id=eq.${userId}&status=neq.want_to_play&select=game_igdb_id,rating,playtime_min`,
    ),
  ]);
  const user = users[0];
  if (!user) return null;

  const rated = logs.filter((l) => l.rating != null);
  const average = rated.length > 0 ? rated.reduce((sum, l) => sum + (l.rating ?? 0), 0) / rated.length : null;
  const minutes = logs.reduce((sum, l) => sum + (l.playtime_min ?? 0), 0);

  // Their three favourites; without any, their three best-rated games.
  const ids = (
    favourites.length > 0
      ? favourites.map((f) => f.game_igdb_id)
      : [...rated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).map((l) => l.game_igdb_id)
  ).slice(0, 3);

  return { username: user.username, games: logs.length, average, hours: Math.round(minutes / 60), covers: await loadCovers(ids) };
}

/** Cover art through the app's own IGDB proxy, in the order asked for. Covers are decoration: failures give none. */
async function loadCovers(ids: number[]): Promise<ShelfSummary["covers"]> {
  if (ids.length === 0) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/igdb-proxy`, {
      method: "POST",
      headers: { ...restHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "/games", body: `fields name,cover.image_id; where id = (${ids.join(",")}); limit ${ids.length};` }),
    });
    if (!res.ok) return [];
    const games = (await res.json()) as { id: number; name: string; cover?: { image_id?: string } }[];
    return ids.flatMap((id) => {
      const game = games.find((g) => g.id === id);
      return game ? [{ name: game.name, imageId: game.cover?.image_id ?? null }] : [];
    });
  } catch {
    return [];
  }
}

// ── Fonts ────────────────────────────────────────────────────────────────────
// Static TrueType instances from Google Fonts (the image renderer can't read
// variable or woff2 fonts). Fetched once per warm instance.

let fontsPromise: Promise<{ name: string; data: ArrayBuffer; weight: 600 | 900 }[]> | null = null;

async function googleFont(query: string): Promise<ArrayBuffer> {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${query}`)).text();
  const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('truetype'\)/)?.[1];
  if (!url) throw new Error("No TrueType font in Google Fonts response");
  return (await fetch(url)).arrayBuffer();
}

function loadFonts() {
  fontsPromise ??= Promise.all([
    googleFont("Anybody:wdth,wght@112.5,900").then((data) => ({ name: "Anybody", data, weight: 900 as const })),
    googleFont("Figtree:wght@600").then((data) => ({ name: "Figtree", data, weight: 600 as const })),
  ]).catch((error: unknown) => {
    fontsPromise = null; // let the next request try again
    throw error;
  });
  return fontsPromise;
}

// ── Image ────────────────────────────────────────────────────────────────────

type Style = Record<string, string | number>;
type Child = Node | string;
interface Node {
  type: string;
  props: { style?: Style; children?: Child | Child[]; src?: string; width?: number; height?: number };
}

const h = (type: string, style: Style, children?: Child | Child[], extra: Partial<Node["props"]> = {}): Node => ({
  type,
  props: { style, ...(children !== undefined ? { children } : {}), ...extra },
});

function shelfImage(summary: ShelfSummary): Node {
  const coverW = 168;
  const coverH = 224;
  const stats = [
    summary.games === 0 ? "Just started their shelf" : `${summary.games} ${summary.games === 1 ? "game" : "games"} on the shelf`,
    ...(summary.average != null ? [`${summary.average.toFixed(1)} average rating`] : []),
    ...(summary.hours > 0 ? [`${summary.hours.toLocaleString("en-US")} hours played`] : []),
  ];
  const name = summary.username.length > 18 ? `${summary.username.slice(0, 17)}…` : summary.username;

  return h("div", {
    display: "flex",
    width: "100%",
    height: "100%",
    padding: "64px 72px",
    backgroundColor: COLORS.wall,
    backgroundImage: "radial-gradient(circle at center, rgba(255,255,255,0.06) 2px, transparent 2.5px)",
    backgroundSize: "28px 28px",
    fontFamily: "Figtree",
    color: COLORS.text,
  }, [
    // Left: who and how much
    h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", flexGrow: 1, minWidth: 0 }, [
      h("div", { display: "flex" }, h("div", {
        display: "flex",
        padding: "6px 18px 4px",
        backgroundColor: COLORS.accent,
        color: COLORS.onAccent,
        borderRadius: 8,
        boxShadow: `0 5px 0 ${COLORS.accentEdge}`,
        fontFamily: "Anybody",
        fontSize: 38,
        transform: "rotate(-3deg)",
      }, "shelved")),
      h("div", { display: "flex", flexDirection: "column" }, [
        h("div", { display: "flex", fontFamily: "Anybody", fontSize: 76, lineHeight: 1, letterSpacing: -2 }, name),
        h("div", { display: "flex", fontFamily: "Anybody", fontSize: 48, lineHeight: 1.1, color: COLORS.accent, marginTop: 8 }, "is on Shelved"),
        h("div", { display: "flex", flexDirection: "column", marginTop: 28, fontSize: 30, color: COLORS.soft }, stats.map((line) => h("div", { display: "flex" }, line))),
      ]),
      h("div", { display: "flex", fontSize: 24, color: COLORS.soft }, "Every game you've played, on one shelf."),
    ]),
    // Right: the favourites, standing on a plank
    summary.covers.length > 0
      ? h("div", { display: "flex", flexDirection: "column", justifyContent: "flex-end", marginLeft: 40 }, [
          h("div", { display: "flex", alignItems: "flex-end", padding: "0 14px" }, summary.covers.map((cover, i) =>
            cover.imageId
              ? h("img", { width: coverW, height: coverH, borderRadius: 8, marginLeft: i === 0 ? 0 : 16, objectFit: "cover" }, undefined, {
                  src: `https://images.igdb.com/igdb/image/upload/t_cover_big/${cover.imageId}.jpg`,
                  width: coverW,
                  height: coverH,
                })
              : h("div", {
                  display: "flex", width: coverW, height: coverH, marginLeft: i === 0 ? 0 : 16, padding: 16, borderRadius: 8,
                  backgroundColor: COLORS.card, color: COLORS.soft, fontFamily: "Anybody", fontSize: 26, alignItems: "center", textAlign: "center",
                }, cover.name),
          )),
          h("div", { display: "flex", height: 18, borderTop: `4px solid ${COLORS.plankTop}`, backgroundColor: COLORS.plank, borderBottom: `9px solid ${COLORS.plankFront}` }),
        ])
      : h("div", { display: "flex" }),
  ]);
}

// ── HTML for link-preview bots ───────────────────────────────────────────────

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

function previewHtml(origin: string, userId: string, summary: ShelfSummary): string {
  const pageUrl = `${origin}/profile/${userId}`;
  const imageUrl = `${origin}/api/share?u=${userId}&image=1`;
  const title = `${summary.username} on Shelved`;
  const parts = [
    summary.games === 0 ? "Just started their shelf" : `${summary.games} ${summary.games === 1 ? "game" : "games"} on their shelf`,
    ...(summary.average != null ? [`rated ${summary.average.toFixed(1)} on average`] : []),
  ];
  const favourites = summary.covers.map((c) => c.name).join(", ");
  const description = `${parts.join(", ")}.${favourites ? ` Favourites: ${favourites}.` : ""}`;
  const [t, d, u, i] = [title, description, pageUrl, imageUrl].map(escapeHtml);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${u}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="Shelved">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta property="og:image" content="${i}">
<meta property="og:image:width" content="${WIDTH}">
<meta property="og:image:height" content="${HEIGHT}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${i}">
</head>
<body><p><a href="${u}">${t}</a>: ${d}</p></body>
</html>`;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get("u") ?? "";
  const wantsImage = url.searchParams.get("image") === "1";

  // Anything that isn't a real profile goes to the app, which handles not-found itself.
  if (!UUID.test(userId) || !SUPABASE_URL || !ANON_KEY) {
    return Response.redirect(`${url.origin}/`, 302);
  }

  let summary: ShelfSummary | null;
  try {
    summary = await loadSummary(userId);
  } catch {
    return new Response("Couldn't load this profile right now.", { status: 503, headers: { "Retry-After": "60" } });
  }
  if (!summary) return Response.redirect(`${url.origin}/`, 302);

  if (!wantsImage) {
    return new Response(previewHtml(url.origin, userId, summary), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
      },
    });
  }

  try {
    const image = new ImageResponse(shelfImage(summary) as unknown as ReactElement, {
      width: WIDTH,
      height: HEIGHT,
      fonts: await loadFonts(),
    });
    const png = await image.arrayBuffer();
    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    // Fall back to the site-wide preview image rather than a broken one.
    return Response.redirect(`${url.origin}/og-image.png`, 302);
  }
}
