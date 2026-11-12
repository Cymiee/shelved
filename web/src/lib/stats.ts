import type { GameLogRow, GameStatus, IGDBGame } from "@gameboxd/lib";

export interface RankedGame {
  game: IGDBGame;
  log: GameLogRow;
}

export interface GenreStat {
  name: string;
  games: number;
  minutes: number;
}

export interface ShelfStats {
  /** Games on the shelf: everything logged except the wishlist. */
  onShelf: number;
  byStatus: Record<GameStatus, number>;
  /** Total playtime across the shelf, in minutes. */
  minutes: number;
  reviews: number;
  rated: number;
  /** Mean rating out of 10, or null when nothing is rated. */
  average: number | null;
  /** Games per rating: index 0 is a rating of 1, index 9 is a 10. */
  ratingSpread: number[];
  /** Most common genres on the shelf, most games first. */
  topGenres: GenreStat[];
  mostPlayed: RankedGame[];
  topRated: RankedGame[];
}

const TOP_GENRES = 5;
const TOP_GAMES = 6;

/**
 * Everything the stats page shows, from a user's logs and the IGDB data for
 * those games. Pure and synchronous, so the numbers can be trusted to match
 * the shelf they were computed from. Wishlist entries count only toward
 * `byStatus.want_to_play`: a game you haven't played says nothing about how
 * you play.
 */
export function computeShelfStats(logs: GameLogRow[], games: Map<number, IGDBGame>): ShelfStats {
  const byStatus: Record<GameStatus, number> = { playing: 0, completed: 0, played: 0, dropped: 0, want_to_play: 0 };
  const ratingSpread = Array.from({ length: 10 }, () => 0);
  const genres = new Map<string, GenreStat>();
  const ranked: RankedGame[] = [];
  let minutes = 0;
  let reviews = 0;
  let rated = 0;
  let ratingSum = 0;

  for (const log of logs) {
    byStatus[log.status]++;
    if (log.status === "want_to_play") continue;

    const played = log.playtime_min ?? 0;
    minutes += played;
    if (log.review) reviews++;
    if (log.rating != null && log.rating >= 1 && log.rating <= 10) {
      const slot = Math.round(log.rating) - 1;
      ratingSpread[slot] = (ratingSpread[slot] ?? 0) + 1;
      ratingSum += log.rating;
      rated++;
    }

    const game = games.get(log.game_igdb_id);
    if (!game) continue;
    ranked.push({ game, log });
    for (const genre of game.genres ?? []) {
      const stat = genres.get(genre.name) ?? { name: genre.name, games: 0, minutes: 0 };
      stat.games++;
      stat.minutes += played;
      genres.set(genre.name, stat);
    }
  }

  return {
    onShelf: logs.length - byStatus.want_to_play,
    byStatus,
    minutes,
    reviews,
    rated,
    average: rated > 0 ? ratingSum / rated : null,
    ratingSpread,
    topGenres: [...genres.values()]
      .sort((a, b) => b.games - a.games || b.minutes - a.minutes)
      .slice(0, TOP_GENRES),
    mostPlayed: ranked
      .filter((r) => (r.log.playtime_min ?? 0) > 0)
      .sort((a, b) => (b.log.playtime_min ?? 0) - (a.log.playtime_min ?? 0))
      .slice(0, TOP_GAMES),
    topRated: ranked
      .filter((r) => r.log.rating != null)
      .sort((a, b) => (b.log.rating ?? 0) - (a.log.rating ?? 0) || b.log.updated_at.localeCompare(a.log.updated_at))
      .slice(0, TOP_GAMES),
  };
}
