import type { IGDBGame } from "@gameboxd/lib";

export interface StoreLink {
  id: string;
  name: string;
  url: string;
  /** Carries an affiliate tag: Shelved may earn a commission on a purchase. */
  affiliate: boolean;
}

export interface AffiliateConfig {
  /** Deep-link template from the network, with `{url}` where the destination goes. */
  humbleTemplate: string | null;
  fanaticalTemplate: string | null;
  amazonTag: string | null;
  /** e.g. "amazon.com", "amazon.in", "amazon.co.uk". */
  amazonDomain: string;
}

export interface StoreLinks {
  /** The publisher's own storefronts, straight from IGDB. Never tagged. */
  official: StoreLink[];
  /** Shops that pay a commission. Only present once that affiliate is configured. */
  shops: StoreLink[];
  /** True when Amazon is among `shops`, which needs Amazon's own disclosure line. */
  hasAmazon: boolean;
}

/** Official storefronts, in the order shown. Matched on the link's host name. */
const OFFICIAL_STORES: { id: string; name: string; hosts: RegExp }[] = [
  { id: "steam", name: "Steam", hosts: /(^|\.)store\.steampowered\.com$/ },
  { id: "epic", name: "Epic Games Store", hosts: /(^|\.)epicgames\.com$/ },
  { id: "gog", name: "GOG", hosts: /(^|\.)gog\.com$/ },
  { id: "playstation", name: "PlayStation Store", hosts: /(^|\.)store\.playstation\.com$/ },
  { id: "xbox", name: "Xbox", hosts: /(^|\.)xbox\.com$/ },
  { id: "nintendo", name: "Nintendo eShop", hosts: /(^|\.)nintendo\.com$/ },
  { id: "itch", name: "itch.io", hosts: /(^|\.)itch\.io$/ },
];

/** IGDB's external-game source id for Amazon listings (uid is the ASIN). */
const AMAZON_SOURCE = 20;
const ASIN = /^[A-Z0-9]{10}$/;

/** Parse a URL from IGDB data, accepting only web links (never `javascript:` and friends). */
function webUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.protocol = "https:";
    return url;
  } catch {
    return null;
  }
}

/** Fill a network's deep-link template. Rejected unless it is an https template with `{url}` in it. */
function fillTemplate(template: string | null, destination: string): string | null {
  if (!template || !template.startsWith("https://") || !template.includes("{url}")) return null;
  return template.replace("{url}", encodeURIComponent(destination));
}

const sellsOnPc = (game: IGDBGame) => (game.platforms ?? []).some((p) => /windows|\bpc\b/i.test(p.name));

/**
 * Where a game can be bought. Official stores come from the game's own
 * website list on IGDB (with its external listings as a fallback); the
 * affiliate shops are added only when configured, so an unconfigured site
 * never shows untagged links to third-party shops.
 */
export function getStoreLinks(game: IGDBGame, config: AffiliateConfig): StoreLinks {
  const candidates = [
    ...(game.websites ?? []).map((w) => w.url),
    ...(game.external_games ?? []).map((e) => e.url),
  ];

  const official: StoreLink[] = [];
  for (const store of OFFICIAL_STORES) {
    for (const raw of candidates) {
      const url = webUrl(raw);
      if (url && store.hosts.test(url.hostname)) {
        official.push({ id: store.id, name: store.name, url: url.toString(), affiliate: false });
        break;
      }
    }
  }

  const shops: StoreLink[] = [];
  const query = encodeURIComponent(game.name);

  if (sellsOnPc(game)) {
    const humble = fillTemplate(config.humbleTemplate, `https://www.humblebundle.com/store/search?search=${query}`);
    if (humble) shops.push({ id: "humble", name: "Humble Store", url: humble, affiliate: true });

    const fanatical = fillTemplate(config.fanaticalTemplate, `https://www.fanatical.com/en/search?search=${query}`);
    if (fanatical) shops.push({ id: "fanatical", name: "Fanatical", url: fanatical, affiliate: true });
  }

  const tag = config.amazonTag?.trim();
  const domain = config.amazonDomain.trim().replace(/^www\./, "");
  if (tag && /^amazon\.[a-z.]{2,8}$/.test(domain)) {
    // Prefer this game's own product page in the configured store; fall back to a search there.
    const asin = (game.external_games ?? []).find((e) => {
      if (e.external_game_source !== AMAZON_SOURCE || !e.uid || !ASIN.test(e.uid)) return false;
      const host = webUrl(e.url)?.hostname.replace(/^www\./, "");
      return host === domain;
    })?.uid;
    const url = new URL(asin ? `https://www.${domain}/dp/${asin}` : `https://www.${domain}/s`);
    if (!asin) {
      url.searchParams.set("k", game.name);
      url.searchParams.set("i", "videogames");
    }
    url.searchParams.set("tag", tag);
    shops.push({ id: "amazon", name: "Amazon", url: url.toString(), affiliate: true });
  }

  return { official, shops, hasAmazon: shops.some((s) => s.id === "amazon") };
}

const env = (name: string): string | null => {
  const value = (import.meta.env as Record<string, string | undefined>)[name]?.trim();
  return value ? value : null;
};

/** Affiliate settings from the build environment (set in Vercel, see .env.example). */
export const affiliateConfig: AffiliateConfig = {
  humbleTemplate: env("VITE_AFFILIATE_HUMBLE_TEMPLATE"),
  fanaticalTemplate: env("VITE_AFFILIATE_FANATICAL_TEMPLATE"),
  amazonTag: env("VITE_AMAZON_TAG"),
  amazonDomain: env("VITE_AMAZON_DOMAIN") ?? "amazon.com",
};
