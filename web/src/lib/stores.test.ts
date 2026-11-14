import { describe, it, expect } from "vitest";
import type { IGDBGame } from "@gameboxd/lib";
import { getStoreLinks } from "./stores";
import type { AffiliateConfig } from "./stores";

const none: AffiliateConfig = { humbleTemplate: null, fanaticalTemplate: null, amazonTag: null, amazonDomain: "amazon.com" };

function game(overrides: Partial<IGDBGame> = {}): IGDBGame {
  return {
    id: 1,
    name: "Hollow Knight",
    summary: null,
    cover: null,
    genres: null,
    platforms: [{ id: 6, name: "PC (Microsoft Windows)" }],
    involved_companies: null,
    first_release_date: null,
    rating: null,
    rating_count: null,
    ...overrides,
  } as IGDBGame;
}

describe("getStoreLinks", () => {
  it("lists official stores in a fixed order, one link each, forcing https", () => {
    const { official } = getStoreLinks(
      game({
        websites: [
          { url: "https://www.gog.com/game/hollow_knight", type: 17 },
          { url: "http://store.steampowered.com/app/367520", type: 13 },
          { url: "https://store.steampowered.com/app/999", type: 13 },
          { url: "https://en.wikipedia.org/wiki/Hollow_Knight", type: 3 },
        ],
      }),
      none,
    );
    expect(official.map((s) => s.id)).toEqual(["steam", "gog"]);
    expect(official[0]?.url).toBe("https://store.steampowered.com/app/367520");
    expect(official.every((s) => !s.affiliate)).toBe(true);
  });

  it("falls back to external listings when the website list lacks a store", () => {
    const { official } = getStoreLinks(
      game({ websites: [], external_games: [{ url: "https://store.playstation.com/en-us/concept/1", external_game_source: 36 }] }),
      none,
    );
    expect(official.map((s) => s.id)).toEqual(["playstation"]);
  });

  it("ignores non-web URLs and look-alike hosts", () => {
    const { official } = getStoreLinks(
      game({
        websites: [
          { url: "javascript:alert(1)" },
          { url: "https://store.steampowered.com.evil.example/app/1" },
          { url: "not a url" },
        ],
      }),
      none,
    );
    expect(official).toEqual([]);
  });

  it("shows no affiliate shops until they are configured", () => {
    const links = getStoreLinks(game(), none);
    expect(links.shops).toEqual([]);
    expect(links.hasAmazon).toBe(false);
  });

  it("fills network templates with the encoded destination, PC games only", () => {
    const config = { ...none, humbleTemplate: "https://net.example/c/1?u={url}", fanaticalTemplate: "http://insecure.example?u={url}" };
    const pc = getStoreLinks(game(), config);
    expect(pc.shops.map((s) => s.id)).toEqual(["humble"]);
    expect(pc.shops[0]?.url).toBe(
      `https://net.example/c/1?u=${encodeURIComponent("https://www.humblebundle.com/store/search?search=Hollow%20Knight")}`,
    );

    const consoleOnly = getStoreLinks(game({ platforms: [{ id: 130, name: "Nintendo Switch" }] }), config);
    expect(consoleOnly.shops).toEqual([]);
  });

  it("links Amazon's product page in the configured store when IGDB has its ASIN", () => {
    const links = getStoreLinks(
      game({
        external_games: [
          { uid: "B07FCVQFHV", url: "https://amazon.com/dp/B07FCVQFHV", external_game_source: 20 },
          { uid: "B0INDIA001", url: "https://www.amazon.in/dp/B0INDIA001", external_game_source: 20 },
        ],
      }),
      { ...none, amazonTag: "shelved-21", amazonDomain: "amazon.in" },
    );
    expect(links.hasAmazon).toBe(true);
    expect(links.shops[0]?.url).toBe("https://www.amazon.in/dp/B0INDIA001?tag=shelved-21");
  });

  it("falls back to an Amazon search when there is no listing for that store", () => {
    const links = getStoreLinks(game({ name: "Celeste & Friends" }), { ...none, amazonTag: "tag-20", amazonDomain: "www.amazon.co.uk" });
    const url = new URL(links.shops[0]?.url ?? "");
    expect(url.hostname).toBe("www.amazon.co.uk");
    expect(url.searchParams.get("k")).toBe("Celeste & Friends");
    expect(url.searchParams.get("tag")).toBe("tag-20");
  });
});
