import { describe, expect, it } from "vitest";
import type { GameLogRow, IGDBGame } from "@gameboxd/lib";
import { computeShelfStats } from "./stats";

let seq = 0;

function log(overrides: Partial<GameLogRow> = {}): GameLogRow {
  seq++;
  return {
    id: `log-${seq}`,
    user_id: "user-1",
    game_igdb_id: seq,
    status: "played",
    rating: null,
    review: null,
    is_liked: false,
    playtime_min: null,
    playtime_manual: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function game(id: number, genres: string[] = []): IGDBGame {
  return {
    id,
    name: `Game ${id}`,
    summary: null,
    cover: null,
    genres: genres.map((name, i) => ({ id: i + 1, name })),
    platforms: null,
    involved_companies: null,
    first_release_date: null,
    rating: null,
    rating_count: null,
  };
}

function gameMap(...games: IGDBGame[]): Map<number, IGDBGame> {
  return new Map(games.map((g) => [g.id, g]));
}

describe("computeShelfStats", () => {
  it("handles an empty shelf", () => {
    const s = computeShelfStats([], new Map());
    expect(s.onShelf).toBe(0);
    expect(s.minutes).toBe(0);
    expect(s.average).toBeNull();
    expect(s.ratingSpread).toEqual(Array.from({ length: 10 }, () => 0));
    expect(s.topGenres).toEqual([]);
    expect(s.mostPlayed).toEqual([]);
    expect(s.topRated).toEqual([]);
  });

  it("counts wishlist entries only in byStatus.want_to_play", () => {
    const wish = log({ status: "want_to_play", rating: 9, review: "hyped", playtime_min: 500, game_igdb_id: 1 });
    const played = log({ status: "completed", game_igdb_id: 2 });
    const s = computeShelfStats([wish, played], gameMap(game(1, ["RPG"]), game(2)));
    expect(s.byStatus.want_to_play).toBe(1);
    expect(s.byStatus.completed).toBe(1);
    expect(s.onShelf).toBe(1);
    expect(s.minutes).toBe(0);
    expect(s.reviews).toBe(0);
    expect(s.rated).toBe(0);
    expect(s.average).toBeNull();
    expect(s.topGenres).toEqual([]);
    expect(s.mostPlayed).toEqual([]);
    expect(s.topRated).toEqual([]);
  });

  it("tallies every status", () => {
    const logs = [
      log({ status: "playing" }),
      log({ status: "completed" }),
      log({ status: "completed" }),
      log({ status: "dropped" }),
      log({ status: "played" }),
    ];
    const s = computeShelfStats(logs, new Map());
    expect(s.byStatus).toEqual({ playing: 1, completed: 2, played: 1, dropped: 1, want_to_play: 0 });
    expect(s.onShelf).toBe(5);
  });

  it("sums minutes and counts reviews", () => {
    const s = computeShelfStats(
      [log({ playtime_min: 90, review: "good" }), log({ playtime_min: 30 }), log({ review: "" })],
      new Map(),
    );
    expect(s.minutes).toBe(120);
    expect(s.reviews).toBe(1);
  });

  describe("ratings", () => {
    it("average is null when nothing is rated", () => {
      expect(computeShelfStats([log(), log()], new Map()).average).toBeNull();
    });

    it("average is the mean of rated logs only", () => {
      const s = computeShelfStats([log({ rating: 8 }), log({ rating: 5 }), log()], new Map());
      expect(s.rated).toBe(2);
      expect(s.average).toBe(6.5);
    });

    it("puts a 10 at index 9 and a 1 at index 0", () => {
      const s = computeShelfStats([log({ rating: 10 }), log({ rating: 10 }), log({ rating: 1 })], new Map());
      expect(s.ratingSpread[9]).toBe(2);
      expect(s.ratingSpread[0]).toBe(1);
    });

    it("ignores ratings outside 1..10", () => {
      const s = computeShelfStats([log({ rating: 0 }), log({ rating: 11 }), log({ rating: -3 }), log({ rating: 7 })], new Map());
      expect(s.rated).toBe(1);
      expect(s.average).toBe(7);
      expect(s.ratingSpread.reduce((a, b) => a + b, 0)).toBe(1);
    });
  });

  describe("topGenres", () => {
    it("sorts by game count, then minutes", () => {
      const logs = [
        log({ game_igdb_id: 1, playtime_min: 10 }),
        log({ game_igdb_id: 2, playtime_min: 10 }),
        log({ game_igdb_id: 3, playtime_min: 500 }),
        log({ game_igdb_id: 4, playtime_min: 100 }),
      ];
      const games = gameMap(game(1, ["RPG"]), game(2, ["RPG"]), game(3, ["Indie"]), game(4, ["Puzzle"]));
      const s = computeShelfStats(logs, games);
      expect(s.topGenres.map((g) => g.name)).toEqual(["RPG", "Indie", "Puzzle"]);
      expect(s.topGenres[0]).toEqual({ name: "RPG", games: 2, minutes: 20 });
    });

    it("caps at 5", () => {
      const names = ["A", "B", "C", "D", "E", "F", "G"];
      const logs = names.map((_, i) => log({ game_igdb_id: i + 1 }));
      const games = gameMap(...names.map((n, i) => game(i + 1, [n])));
      expect(computeShelfStats(logs, games).topGenres).toHaveLength(5);
    });

    it("counts a multi-genre game toward each genre", () => {
      const s = computeShelfStats([log({ game_igdb_id: 1, playtime_min: 60 })], gameMap(game(1, ["RPG", "Action"])));
      expect(s.topGenres).toHaveLength(2);
      expect(s.topGenres.every((g) => g.games === 1 && g.minutes === 60)).toBe(true);
    });
  });

  describe("mostPlayed", () => {
    it("excludes zero or missing playtime and sorts descending", () => {
      const logs = [
        log({ game_igdb_id: 1, playtime_min: 0 }),
        log({ game_igdb_id: 2, playtime_min: null }),
        log({ game_igdb_id: 3, playtime_min: 30 }),
        log({ game_igdb_id: 4, playtime_min: 300 }),
      ];
      const s = computeShelfStats(logs, gameMap(game(1), game(2), game(3), game(4)));
      expect(s.mostPlayed.map((r) => r.game.id)).toEqual([4, 3]);
    });

    it("caps at 6", () => {
      const logs = Array.from({ length: 8 }, (_, i) => log({ game_igdb_id: i + 1, playtime_min: (i + 1) * 10 }));
      const s = computeShelfStats(logs, gameMap(...logs.map((l) => game(l.game_igdb_id))));
      expect(s.mostPlayed).toHaveLength(6);
      expect(s.mostPlayed[0]?.game.id).toBe(8);
    });
  });

  describe("topRated", () => {
    it("sorts by rating, ties broken by most recent updated_at", () => {
      const logs = [
        log({ game_igdb_id: 1, rating: 9, updated_at: "2026-01-01T00:00:00Z" }),
        log({ game_igdb_id: 2, rating: 9, updated_at: "2026-03-01T00:00:00Z" }),
        log({ game_igdb_id: 3, rating: 10, updated_at: "2025-01-01T00:00:00Z" }),
        log({ game_igdb_id: 4, rating: 9, updated_at: "2026-02-01T00:00:00Z" }),
        log({ game_igdb_id: 5 }),
      ];
      const s = computeShelfStats(logs, gameMap(game(1), game(2), game(3), game(4), game(5)));
      expect(s.topRated.map((r) => r.game.id)).toEqual([3, 2, 4, 1]);
    });

    it("caps at 6", () => {
      const logs = Array.from({ length: 8 }, (_, i) => log({ game_igdb_id: i + 1, rating: 5 }));
      const s = computeShelfStats(logs, gameMap(...logs.map((l) => game(l.game_igdb_id))));
      expect(s.topRated).toHaveLength(6);
    });
  });

  it("counts logs with unknown games in totals but not genres or top lists", () => {
    const logs = [
      log({ game_igdb_id: 1, rating: 8, playtime_min: 120, review: "nice" }),
      log({ game_igdb_id: 999, rating: 6, playtime_min: 60 }),
    ];
    const s = computeShelfStats(logs, gameMap(game(1, ["RPG"])));
    expect(s.onShelf).toBe(2);
    expect(s.minutes).toBe(180);
    expect(s.rated).toBe(2);
    expect(s.average).toBe(7);
    expect(s.topGenres).toEqual([{ name: "RPG", games: 1, minutes: 120 }]);
    expect(s.mostPlayed.map((r) => r.game.id)).toEqual([1]);
    expect(s.topRated.map((r) => r.game.id)).toEqual([1]);
  });
});
