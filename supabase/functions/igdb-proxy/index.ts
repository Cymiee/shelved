const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// How long proxied IGDB responses stay fresh. Game metadata changes slowly and
// the lists are "trending"/"new releases" style queries, so minutes are fine.
const RESPONSE_TTL_SECONDS = 600;

// The proxy holds the Twitch credentials, so it only forwards what the app
// actually uses. Anything else is refused rather than passed along.
const ALLOWED_ENDPOINTS = new Set(["/games", "/external_games"]);
// The largest legitimate query is a 500-id lookup (~4 kB). Double that.
const MAX_BODY_CHARS = 8000;

// Refresh the Twitch token this long before it actually expires.
const TOKEN_SKEW_SECONDS = 300;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const restHeaders = {
  "Content-Type": "application/json",
  apikey: SERVICE_ROLE_KEY ?? "",
  Authorization: `Bearer ${SERVICE_ROLE_KEY ?? ""}`,
};

interface CacheRow {
  value: unknown;
  expires_at: string;
}

// In-isolate cache in front of the database one. The function runs in a
// different region from the database, so even a DB cache hit costs a
// cross-region round trip; a warm isolate can answer repeats without it.
const MEMORY_MAX_ENTRIES = 300;
const memory = new Map<string, { value: unknown; expiresAt: number }>();

function memoryGet<T>(key: string): T | null {
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.value as T;
}

function memorySet(key: string, value: unknown, expiresAt: number): void {
  if (memory.size >= MEMORY_MAX_ENTRIES) {
    // Map iterates in insertion order, so this evicts the oldest entry.
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  memory.set(key, { value, expiresAt });
}

/**
 * Read a live cache entry: memory first, then the database. Returns null on
 * miss, expiry, or any cache failure — the cache is strictly an optimisation
 * and must never break a request.
 */
async function cacheGet<T>(key: string): Promise<T | null> {
  const inMemory = memoryGet<T>(key);
  if (inMemory !== null) return inMemory;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/igdb_cache?key=eq.${encodeURIComponent(key)}&select=value,expires_at&limit=1`,
      { headers: restHeaders },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as CacheRow[];
    const row = rows[0];
    if (!row) return null;
    const expiresAt = new Date(row.expires_at).getTime();
    if (expiresAt <= Date.now()) return null;
    memorySet(key, row.value, expiresAt);
    return row.value as T;
  } catch {
    return null;
  }
}

declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined;

/**
 * Upsert a cache entry without blocking the response. Writing the cache is not
 * something the caller should wait on — awaiting it added ~1s to every miss.
 * waitUntil keeps the isolate alive until the write lands.
 */
function cacheSet(key: string, value: unknown, ttlSeconds: number): void {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  memorySet(key, value, expiresAt);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return;
  const write = fetch(`${SUPABASE_URL}/rest/v1/igdb_cache?on_conflict=key`, {
    method: "POST",
    headers: { ...restHeaders, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      key,
      value,
      expires_at: new Date(expiresAt).toISOString(),
    }),
  }).catch(() => {});

  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(write);
  }
}

async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function mintToken(): Promise<string> {
  const clientId = Deno.env.get("IGDB_CLIENT_ID");
  const clientSecret = Deno.env.get("IGDB_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Missing IGDB_CLIENT_ID or IGDB_CLIENT_SECRET env vars");
  }

  // Credentials go in the POST body, never the URL: a network error's message
  // can include the URL, and URLs end up in logs.
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Twitch token fetch failed: ${res.status}`);

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cacheSet("twitch_token", json.access_token, Math.max(json.expires_in - TOKEN_SKEW_SECONDS, 60));
  return json.access_token;
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const cached = await cacheGet<string>("twitch_token");
    if (cached) return cached;
  }
  return mintToken();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") return fail(405, "Use POST.");

  let endpoint: unknown;
  let body: unknown;
  try {
    ({ endpoint, body } = (await req.json()) as { endpoint?: unknown; body?: unknown });
  } catch {
    return fail(400, "Request body must be JSON.");
  }
  if (typeof endpoint !== "string" || !ALLOWED_ENDPOINTS.has(endpoint)) {
    return fail(400, "That IGDB endpoint isn't available through this proxy.");
  }
  if (typeof body !== "string" || body.length === 0 || body.length > MAX_BODY_CHARS) {
    return fail(400, "Query is missing or too long.");
  }

  try {
    const cacheKey = `q:${await sha256(`${endpoint}\n${body}`)}`;
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached !== null) {
      return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
      });
    }

    const clientId = Deno.env.get("IGDB_CLIENT_ID")!;

    const callIgdb = (token: string) =>
      fetch(`https://api.igdb.com/v4${endpoint}`, {
        method: "POST",
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${token}`,
          "Content-Type": "text/plain",
          Accept: "application/json",
        },
        body,
      });

    let igdbRes = await callIgdb(await getAccessToken());
    // A cached token can be stale — e.g. the Twitch secret was rotated, which
    // revokes it. On an auth failure, mint a fresh token and retry once so the
    // proxy self-heals instead of 500ing until the cache expires.
    if (igdbRes.status === 401 || igdbRes.status === 403) {
      igdbRes = await callIgdb(await getAccessToken(true));
    }

    if (!igdbRes.ok) {
      // A malformed query is the caller's problem; everything else is ours.
      return igdbRes.status === 400
        ? fail(400, "IGDB rejected that query.")
        : fail(502, "Couldn't reach the game database. Try again shortly.");
    }

    const data = await igdbRes.json();
    cacheSet(cacheKey, data, RESPONSE_TTL_SECONDS);

    // Drop expired rows occasionally rather than running a scheduled job.
    if (Math.random() < 0.02 && SUPABASE_URL && SERVICE_ROLE_KEY) {
      fetch(`${SUPABASE_URL}/rest/v1/rpc/prune_igdb_cache`, {
        method: "POST",
        headers: restHeaders,
        body: "{}",
      }).catch(() => {});
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" },
    });
  } catch (err) {
    // Log the detail server-side only. Raw error text can carry URLs or
    // upstream messages that callers have no business seeing.
    console.error("igdb-proxy failed:", err);
    return fail(500, "Something went wrong loading game data.");
  }
});

function fail(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
