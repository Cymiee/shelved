import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import type { IGDBGame } from "@gameboxd/lib";
import { searchGames, getBrowseGames } from "../lib/igdb";
import type { SortMode } from "../lib/igdb";
import GameCard from "../components/GameCard";
import { SearchIcon } from "../components/icons";
import { useIsMobile } from "../hooks/useIsMobile";

// ── Static filter data ────────────────────────────────────────────────────────

const GENRES: { id: number; name: string }[] = [
  { id: 2,  name: "Point-and-Click" },
  { id: 4,  name: "Fighting" },
  { id: 5,  name: "Shooter" },
  { id: 7,  name: "Music" },
  { id: 8,  name: "Platform" },
  { id: 9,  name: "Puzzle" },
  { id: 10, name: "Racing" },
  { id: 11, name: "RTS" },
  { id: 12, name: "RPG" },
  { id: 13, name: "Simulator" },
  { id: 14, name: "Sport" },
  { id: 15, name: "Strategy" },
  { id: 16, name: "TBS" },
  { id: 24, name: "Tactical" },
  { id: 25, name: "Hack & Slash" },
  { id: 26, name: "Quiz / Trivia" },
  { id: 30, name: "Pinball" },
  { id: 31, name: "Adventure" },
  { id: 32, name: "Indie" },
  { id: 33, name: "Arcade" },
  { id: 34, name: "Visual Novel" },
  { id: 35, name: "Card & Board" },
  { id: 36, name: "MOBA" },
];

const THEMES_ALL: { id: number; name: string }[] = [
  { id: 1,  name: "Action" },
  { id: 17, name: "Fantasy" },
  { id: 18, name: "Sci-Fi" },
  { id: 19, name: "Horror" },
  { id: 20, name: "Thriller" },
  { id: 21, name: "Survival" },
  { id: 22, name: "Historical" },
  { id: 23, name: "Stealth" },
  { id: 27, name: "Comedy" },
  { id: 28, name: "Business" },
  { id: 31, name: "Drama" },
  { id: 32, name: "Non-Fiction" },
  { id: 33, name: "Sandbox" },
  { id: 34, name: "Educational" },
  { id: 35, name: "Kids" },
  { id: 38, name: "Open World" },
  { id: 39, name: "Warfare" },
  { id: 40, name: "Party" },
  { id: 41, name: "4X" },
  { id: 42, name: "Erotic" },
  { id: 43, name: "Mystery" },
  { id: 44, name: "Romance" },
];

const THEMES = THEMES_ALL.filter((t) => t.id !== 42);

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "trending",      label: "Trending" },
  { value: "top_rated",    label: "Top rated" },
  { value: "new_releases", label: "New releases" },
];

const SORT_TITLES: Record<SortMode, string> = {
  trending:     "Trending games",
  top_rated:    "Top rated games",
  new_releases: "New releases",
};

const SORT_SUBTITLES: Record<SortMode, string> = {
  trending:     "What the community is playing right now",
  top_rated:    "Highest rated games of all time",
  new_releases: "The latest releases",
};

// ── FilterPill ────────────────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  // Category tags: inactive ones read as one quiet group; the active one
  // becomes a solid yellow label.
  return (
    <button
      type="button"
      onClick={onClick}
      className="press"
      aria-pressed={active}
      style={{
        padding: "6px 12px",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        background: active ? "var(--accent)" : "var(--bg-card)",
        color: active ? "var(--on-accent)" : "var(--text-secondary)",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        fontFamily: "var(--font-body)",
        whiteSpace: "nowrap",
        lineHeight: 1.5,
        transition: "background var(--transition), color var(--transition), border-color var(--transition)",
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-primary)"; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; } }}
    >
      {label}
    </button>
  );
}

// ── SidebarLabel ──────────────────────────────────────────────────────────────

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="label" style={{ marginBottom: "var(--space-3)" }}>
      {children}
    </div>
  );
}

// ── SkeletonCard ──────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          width: "100%",
          aspectRatio: "3 / 4",
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-card)",
          animation: "skeletonPulse 1.5s ease-in-out infinite",
        }}
      />
      <div
        style={{
          height: 14,
          borderRadius: 4,
          background: "var(--bg-card)",
          marginTop: "var(--space-3)",
          width: "70%",
          animation: "skeletonPulse 1.5s ease-in-out infinite",
        }}
      />
    </div>
  );
}

// ── ExplorePage ─────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const q = searchParams.get("q") ?? "";

  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<number | null>(null);
  const [sort, setSort] = useState<SortMode>("trending");
  const [results, setResults] = useState<IGDBGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasFilters = selectedGenre !== null || selectedTheme !== null;

  // Reset filters when search query changes
  useEffect(() => {
    setSelectedGenre(null);
    setSelectedTheme(null);
  }, [q]);

  // Fetch games
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setResults([]);
    setError(null);

    // Pure text search (no genre/theme) uses name-match search
    let load: Promise<IGDBGame[]>;
    if (q && !hasFilters) {
      load = searchGames(q);
    } else {
      const opts: { sort: SortMode; genreId?: number; themeId?: number; query?: string } = { sort };
      if (selectedGenre !== null) opts.genreId = selectedGenre;
      if (selectedTheme !== null) opts.themeId = selectedTheme;
      if (q) opts.query = q;
      load = getBrowseGames(opts);
    }

    load
      .then((games) => { if (!cancelled) setResults(games); })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load games. Reload to try again.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [q, selectedGenre, selectedTheme, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGenre = (id: number) =>
    setSelectedGenre((prev) => (prev === id ? null : id));

  const toggleTheme = (id: number) =>
    setSelectedTheme((prev) => (prev === id ? null : id));

  const clearFilters = () => {
    setSelectedGenre(null);
    setSelectedTheme(null);
  };

  // Dynamic heading
  const activeGenre = GENRES.find((g) => g.id === selectedGenre);
  const activeTheme = THEMES.find((t) => t.id === selectedTheme);
  const headingParts = [activeGenre?.name, activeTheme?.name].filter(Boolean);

  const pageTitle = q
    ? `Results for "${q}"`
    : headingParts.length > 0
    ? headingParts.join(" ") + " games"
    : SORT_TITLES[sort];

  const subtitle = q
    ? undefined
    : headingParts.length > 0
    ? `Browsing ${headingParts.join(" · ")}`
    : SORT_SUBTITLES[sort];

  // Mobile: filters become horizontally-scrollable rows above the results
  const pillRowStyle: React.CSSProperties = isMobile
    ? { display: "flex", gap: "0.35rem", overflowX: "auto", paddingBottom: "0.35rem", scrollbarWidth: "none" }
    : { display: "flex", flexWrap: "wrap", gap: "0.35rem" };

  // Auto-fill so wide screens pack more, smaller cards instead of four giant
  // ones — feels denser and more premium.
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: isMobile
      ? "repeat(auto-fill, minmax(100px, 1fr))"
      : "repeat(auto-fill, minmax(158px, 1fr))",
    gap: isMobile ? "20px 12px" : "28px 20px",
    // half the column gap, so each card's plank segment meets its neighbour's
    ["--plank-overhang" as string]: isMobile ? "6px" : "10px",
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: isMobile ? "1.25rem 16px" : "2rem 24px" }}>

      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? "1.25rem" : "2rem",
          alignItems: isMobile ? "stretch" : "flex-start",
        }}
      >
        {/* ── Sidebar (filter rows on mobile) ── */}
        <div
          style={
            isMobile
              ? { width: "100%" }
              : {
                  width: 200,
                  flexShrink: 0,
                  position: "sticky",
                  // clear the sticky navbar
                  top: 80,
                  maxHeight: "calc(100vh - 100px)",
                  overflowY: "auto",
                  scrollbarWidth: "none",
                }
          }
        >
          {hasFilters && (
            <button
              onClick={clearFilters}
              style={{
                display: "block",
                width: "100%",
                marginBottom: "1rem",
                padding: "0.35rem",
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "var(--font-body)",
                transition: "border-color 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              ✕ Clear filters
            </button>
          )}

          {/* Genres */}
          <div style={{ marginBottom: isMobile ? "0.75rem" : "1.25rem" }}>
            <SidebarLabel>Genres</SidebarLabel>
            <div style={pillRowStyle}>
              {GENRES.map((g) => (
                <FilterPill
                  key={g.id}
                  label={g.name}
                  active={selectedGenre === g.id}
                  onClick={() => toggleGenre(g.id)}
                />
              ))}
            </div>
          </div>

          {/* Divider */}
          {!isMobile && <div style={{ height: 1, background: "var(--border)", marginBottom: "1.25rem" }} />}

          {/* Themes */}
          <div style={{ marginBottom: isMobile ? 0 : "1.5rem" }}>
            <SidebarLabel>Themes</SidebarLabel>
            <div style={pillRowStyle}>
              {THEMES.map((t) => (
                <FilterPill
                  key={t.id}
                  label={t.name}
                  active={selectedTheme === t.id}
                  onClick={() => toggleTheme(t.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Heading — says what the grid below is currently showing */}
          <div style={{ marginBottom: "1.5rem" }}>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontStretch: "104%",
                fontSize: "clamp(2rem, 6vw, 3.25rem)",
                fontWeight: 900,
                letterSpacing: "-0.03em",
                lineHeight: 1,
                margin: 0,
                color: "var(--text-primary)",
                overflowWrap: "anywhere",
              }}
            >
              {pageTitle}
            </h1>
            {subtitle && (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-base)",
                  color: "var(--text-secondary)",
                  margin: "var(--space-2) 0 0",
                }}
              >
                {subtitle}
              </p>
            )}
          </div>

          {/* Sort bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              marginBottom: "1.5rem",
              gap: "0.75rem 1rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {SORT_OPTIONS.map((opt) => (
                <FilterPill
                  key={opt.value}
                  label={opt.label}
                  active={sort === opt.value}
                  onClick={() => setSort(opt.value)}
                />
              ))}
            </div>
            {!loading && results.length > 0 && (
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-body)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                Showing {results.length} games
              </span>
            )}
          </div>

          {error && (
            <p style={{ color: "var(--danger)", fontFamily: "var(--font-body)" }}>{error}</p>
          )}

          {/* Grid — skeleton / empty / results */}
          {loading ? (
            <div style={gridStyle}>
              {Array.from({ length: isMobile ? 9 : 12 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : !error && results.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.85rem",
                padding: "5rem 2rem",
                textAlign: "center",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
              }}
            >
              <div style={{ color: "var(--text-muted)", opacity: 0.7 }}>
                <SearchIcon size={40} strokeWidth={1.6} />
              </div>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-xl)",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                No games found
              </p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
                {q ? `Nothing matched "${q}".` : "Try a different genre or theme."}
              </p>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="press"
                  style={{
                    marginTop: "0.35rem",
                    padding: "0.5rem 1.1rem",
                    background: "var(--accent-dim)",
                    border: "1px solid var(--accent-ring)",
                    color: "var(--accent)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div
              key={`${sort}-${selectedGenre}-${selectedTheme}-${q}`}
              style={gridStyle}
            >
              {results.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  onSelect={(g) => navigate(`/game/${g.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
