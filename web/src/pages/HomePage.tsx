import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import type { IGDBGame } from "@gameboxd/lib";
import { getPopularAmongFriends, GENRE_IGDB_MAP } from "@gameboxd/lib";
import type { GenreTag } from "@gameboxd/lib";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/auth";
import { getTrendingGames, getGames, getGame, getNewReleases, getGamesByTags } from "../lib/igdb";
import GameCard from "../components/GameCard";
import FriendsActivityWall from "../components/FriendsActivityWall";
import RecommendationRow from "../components/RecommendationRow";
import FeaturedHero from "../components/FeaturedHero";
import HomeHero from "../components/HomeHero";
import YourShelfStrip from "../components/YourShelfStrip";
import CommunityReviews from "../components/CommunityReviews";
import LogGameModal from "../components/LogGameModal";
import Spinner from "../components/Spinner";
import Shelf, { ShelfHeader, ShelfSkeleton } from "../components/Shelf";
import { useGamesStore } from "../store/games";
import { useToastStore } from "../store/toast";
import { useIsMobile } from "../hooks/useIsMobile";
import { useFriendsFeed } from "../hooks/useFriendsFeed";
import { color, font, space } from "../theme";

// ── Shelf of game covers ─────────────────────────────────────────────────────

function GameShelf({ title, games, loading, onQuickLog }: {
  title: string;
  games: IGDBGame[];
  loading: boolean;
  onQuickLog?: (game: IGDBGame) => void;
}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const itemWidth = isMobile ? 128 : 168;
  if (loading) return <ShelfSkeleton title={title} itemWidth={itemWidth} />;
  if (games.length === 0) return null;

  return (
    <Shelf title={title} count={games.length} itemWidth={itemWidth}>
      {games.map((g) => (
        <GameCard
          key={g.id}
          game={g}
          onSelect={(game) => navigate(`/game/${game.id}`)}
          {...(onQuickLog ? { onQuickLog } : {})}
        />
      ))}
    </Shelf>
  );
}

// ── Get-started card ─────────────────────────────────────────────────────────

/**
 * Shown to signed-in users with no friend activity yet. The first useful action
 * for a new account is logging a game, not finding friends — so Explore leads.
 */
function GetStartedCard({ hasLogs }: { hasLogs: boolean }) {
  return (
    <section
      style={{
        marginBottom: space[7],
        padding: space[5],
        background: color.bgCard,
        border: `1.5px dashed ${color.borderStrong}`,
        borderRadius: "var(--radius-lg)",
      }}
    >
      <h2
        style={{
          fontFamily: font.display,
          fontSize: "var(--text-xl)",
          fontWeight: 800,
          lineHeight: 1.2,
          color: color.text,
          margin: 0,
          marginBottom: space[2],
        }}
      >
        {hasLogs ? "Your friends' activity will show up here" : "Your shelf is empty"}
      </h2>
      <p
        style={{
          color: color.textSecondary,
          fontSize: "var(--text-base)",
          lineHeight: 1.55,
          margin: 0,
          marginBottom: space[5],
          maxWidth: "52ch",
        }}
      >
        {hasLogs
          ? "Add a friend and what they log, rate and review lands on this page."
          : "Log a game you've played to put the first case on it. Then add friends to see what they're playing."}
      </p>

      <div style={{ display: "flex", gap: space[3], flexWrap: "wrap" }}>
        <Link to={hasLogs ? "/friends" : "/explore"} className="btn-key">
          {hasLogs ? "Find friends" : "Explore games"}
        </Link>
        <Link to={hasLogs ? "/explore" : "/friends"} className="btn-key btn-key--wall">
          {hasLogs ? "Explore games" : "Find friends"}
        </Link>
      </div>
    </section>
  );
}

// A recent-activity preview, not the full feed (that lives at /feed).
const HOME_ACTIVITY_LIMIT = 6;

// ── HomePage ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { userId, profileTags } = useAuthStore();
  const { logGame, logs, fetchLogs } = useGamesStore();
  const showToast = useToastStore((s) => s.show);
  const isMobile = useIsMobile();
  // Until the user's logs have loaded we can't tell an empty shelf from a
  // loading one, and must not flash the "your shelf is empty" prompt.
  const [logsLoaded, setLogsLoaded] = useState(false);

  const [recommended, setRecommended] = useState<IGDBGame[]>([]);
  const [recommendedLoading, setRecommendedLoading] = useState(false);

  // "Because you loved X" — seeded by the user's highest-rated logged game.
  const [seedGame, setSeedGame] = useState<IGDBGame | null>(null);
  const [seedRecs, setSeedRecs] = useState<IGDBGame[]>([]);

  // The full trending set feeds the signed-out hero shelf; the shelf row
  // further down shows just the top of it.
  const [trendingAll, setTrendingAll] = useState<IGDBGame[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const trending = trendingAll.slice(0, 7);

  const [newReleases, setNewReleases] = useState<IGDBGame[]>([]);
  const [newReleasesLoading, setNewReleasesLoading] = useState(true);

  const { items: friendsFeed, loading: friendsFeedLoading } = useFriendsFeed(userId, HOME_ACTIVITY_LIMIT);

  const [popularFriends, setPopularFriends] = useState<IGDBGame[]>([]);
  const [popularFriendsLoading, setPopularFriendsLoading] = useState(false);

  const [quickLogGame, setQuickLogGame] = useState<IGDBGame | null>(null);

  // Own logs — drive the shelf strip, the get-started prompt and recommendations
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        await fetchLogs();
      } catch {
        // Home still works without the user's own logs.
      } finally {
        if (!cancelled) setLogsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, fetchLogs]);

  // Trending
  useEffect(() => {
    getTrendingGames()
      .then(setTrendingAll)
      .catch(() => {})
      .finally(() => setTrendingLoading(false));
  }, []);

  // New releases
  useEffect(() => {
    getNewReleases(7)
      .then(setNewReleases)
      .catch(() => {})
      .finally(() => setNewReleasesLoading(false));
  }, []);

  // Genre-based suggestions — driven by onboarding picks PLUS genres learned
  // from games the user has rated highly.
  const suggestionGenres = [...new Set([...(profileTags?.genres ?? []), ...(profileTags?.played_genres ?? [])])];
  const genresKey = suggestionGenres.join(",");
  useEffect(() => {
    if (!userId || suggestionGenres.length === 0) { setRecommended([]); return; }

    const genreIds = [...new Set(suggestionGenres.flatMap((g) => GENRE_IGDB_MAP[g as GenreTag]?.genres ?? []))];
    const themeIds = [...new Set(suggestionGenres.flatMap((g) => GENRE_IGDB_MAP[g as GenreTag]?.themes ?? []))];

    setRecommendedLoading(true);
    getGamesByTags(genreIds, themeIds, [], 24)
      .then(setRecommended)
      .catch(() => {})
      .finally(() => setRecommendedLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, genresKey]);

  // Seed "Because you loved X" from the user's highest-rated logged game.
  const topRatedLog = [...logs].filter((l) => (l.rating ?? 0) >= 8).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
  const seedId = topRatedLog?.game_igdb_id ?? null;
  useEffect(() => {
    if (!seedId) { setSeedGame(null); setSeedRecs([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const seed = await getGame(seedId);
        if (cancelled) return;
        setSeedGame(seed);
        const ids = seed.similar_games ?? [];
        const games = ids.length > 0 ? await getGames(ids) : [];
        if (!cancelled) setSeedRecs(games);
      } catch {
        if (!cancelled) { setSeedGame(null); setSeedRecs([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [seedId]);

  // Popular among friends (logged-in only)
  useEffect(() => {
    if (!userId) return;

    setPopularFriendsLoading(true);
    async function loadPopular() {
      const entries = await getPopularAmongFriends(supabase, userId!);
      if (entries.length === 0) { setPopularFriendsLoading(false); return; }
      const ids = entries.map((e) => e.gameIgdbId);
      const games = await getGames(ids);
      setPopularFriends(games);
    }

    loadPopular()
      .catch(() => {})
      .finally(() => setPopularFriendsLoading(false));
  }, [userId]);

  const handleQuickLog = (game: IGDBGame) => setQuickLogGame(game);
  const hasActivity = friendsFeed.length > 0;

  // The shop-window game — the top trending title that has wide art.
  const featured = trending.find((g) => g.artworks?.length || g.screenshots?.length) ?? trending[0] ?? newReleases[0] ?? null;

  const addFeaturedToWishlist = async () => {
    if (!featured) return;
    try {
      await logGame(featured.id, "want_to_play", undefined, undefined, (featured.genres ?? []).map((g) => g.id));
      showToast(`Added ${featured.name} to your wishlist`, { to: "/want-to-play", label: "View" });
    } catch (e) {
      showToast(`Couldn't add ${featured.name}. Try again.`);
      throw e;
    }
  };

  // Don't suggest games the user has already logged.
  const loggedIds = new Set(logs.map((l) => l.game_igdb_id));
  const recommendedFresh = recommended.filter((g) => !loggedIds.has(g.id));
  const seedRecsFresh = seedRecs.filter((g) => !loggedIds.has(g.id));
  const hasGenres = suggestionGenres.length > 0;

  // The wishlist isn't on the shelf yet: those are games still in the shop.
  const shelfLogs = logs.filter((l) => l.status !== "want_to_play");
  const featuredOnShelf = featured != null && loggedIds.has(featured.id);

  // Signed-out hero shelf: everything popular, without duplicates.
  const heroGames = [...new Map([...trendingAll, ...newReleases].map((g) => [g.id, g])).values()];

  return (
    <div style={{ paddingBottom: "4rem" }}>
      {/* Signed out: say what this is, and let people play with a shelf. */}
      {!userId && <HomeHero games={heroGames} />}

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: isMobile ? "2.5rem 16px 0" : "3.5rem 24px 0" }}>

        {/* Signed in: their own shelf leads. */}
        {userId && shelfLogs.length > 0 && <YourShelfStrip logs={shelfLogs} />}
        {userId && logsLoaded && logs.length === 0 && <GetStartedCard hasLogs={false} />}

        {/* ── Friend activity — only once there is any. With an empty feed it
               would push the useful content below the fold, so discovery
               leads instead and the prompt moves underneath. ── */}
        {userId && hasActivity && (
          <section style={{ marginBottom: space[7] }}>
            <ShelfHeader
              title="From your friends"
              count={friendsFeed.length}
              action={<Link to="/feed" className="nav-link">See all</Link>}
            />
            <FriendsActivityWall items={friendsFeed} />
          </section>
        )}

        {userId && friendsFeedLoading && (
          <section style={{ marginBottom: space[7] }}>
            <ShelfHeader title="From your friends" />
            <div style={{ height: 120, display: "flex", alignItems: "center" }}>
              <Spinner />
            </div>
          </section>
        )}

        {/* The community's newest reviews — people, not products. Everyone
            sees this, signed in or not; it is the page's proof of life. */}
        <CommunityReviews />

        {/* ── The shop window ── */}
        {featured && (
          <FeaturedHero
            game={featured}
            {...(userId
              ? featuredOnShelf
                ? { secondaryLabel: "Explore more", secondaryTo: "/explore" }
                : { secondaryLabel: "Add to wishlist", secondaryDoneLabel: "On your wishlist", onSecondary: addFeaturedToWishlist }
              : { secondaryLabel: "Start your shelf", secondaryTo: "/auth?mode=signup" })}
          />
        )}

        {/* Personalised discovery. "Because you loved X" (seeded by a
            top-rated log) takes priority; otherwise fall back to genre-based. */}
        {userId && seedGame && seedRecsFresh.length > 0 ? (
          <RecommendationRow seed={seedGame} games={seedRecsFresh} onQuickLog={handleQuickLog} />
        ) : (
          userId && hasGenres && (recommendedLoading || recommendedFresh.length > 0) && (
            <GameShelf
              title="Based on your genres"
              games={recommendedFresh}
              loading={recommendedLoading}
              onQuickLog={handleQuickLog}
            />
          )
        )}

        <GameShelf
          title="Trending now"
          games={trending}
          loading={trendingLoading}
          {...(userId ? { onQuickLog: handleQuickLog } : {})}
        />

        <GameShelf
          title="New releases"
          games={newReleases}
          loading={newReleasesLoading}
          {...(userId ? { onQuickLog: handleQuickLog } : {})}
        />

        {userId && (
          <GameShelf
            title="Popular with your friends"
            games={popularFriends}
            loading={popularFriendsLoading}
            onQuickLog={handleQuickLog}
          />
        )}

        {/* Has a shelf but nothing to catch up on yet — point at friends */}
        {userId && !friendsFeedLoading && !hasActivity && logs.length > 0 && (
          <GetStartedCard hasLogs />
        )}
      </div>

      {/* ── Quick-log modal ── */}
      {quickLogGame && (
        <LogGameModal
          game={quickLogGame}
          onClose={() => setQuickLogGame(null)}
          onSave={async (status, rating, review, playtimeMin) => {
            await logGame(
              quickLogGame.id,
              status,
              rating ?? undefined,
              review ?? undefined,
              (quickLogGame.genres ?? []).map((g) => g.id),
              playtimeMin,
            );
            // Stay on Home so several games can be logged in a row; the
            // confirmation carries the link to the game instead.
            showToast(`Logged ${quickLogGame.name}`, { to: `/game/${quickLogGame.id}`, label: "View" });
          }}
        />
      )}
    </div>
  );
}
