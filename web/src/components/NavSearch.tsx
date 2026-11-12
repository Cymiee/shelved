import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { IGDBGame } from "@gameboxd/lib";
import { searchGames } from "../lib/igdb";
import { useGamesStore } from "../store/games";
import { useToastStore } from "../store/toast";
import GameCover from "./GameCover";
import LogGameModal from "./LogGameModal";
import Spinner from "./Spinner";
import { SearchIcon, CloseIcon, PlusIcon } from "./icons";

interface Props {
  isMobile: boolean;
  /** Signed in: each result also gets a one-tap "log it" button. */
  canLog: boolean;
}

const DEBOUNCE_MS = 250;
const MAX_RESULTS = 6;

/**
 * The navbar's game search. Results appear as you type; Enter (or "See all
 * results") still goes to the full Explore results, so nothing that worked
 * before is lost.
 *
 * Renders its pieces as siblings so they sit directly in the navbar's flex
 * row: the collapsing field (with the results popover hanging off it) and
 * the toggle button.
 */
export default function NavSearch({ isMobile, canLog }: Props) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const logGame = useGamesStore((s) => s.logGame);
  const showToast = useToastStore((s) => s.show);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IGDBGame[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [logging, setLogging] = useState<IGDBGame | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const term = query.trim();
  const shown = (results ?? []).slice(0, MAX_RESULTS);
  const popoverOpen = open && term.length >= 2 && (results !== null || loading);

  const close = () => {
    setOpen(false);
    setQuery("");
    setResults(null);
    setActive(-1);
  };

  // Focus the field the moment the search expands.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Going anywhere closes the search.
  useEffect(() => {
    close();
  }, [pathname, search]);

  // "/" opens search from anywhere, unless the person is already typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Clicking or tapping anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (term.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const games = await searchGames(term);
        if (!cancelled) { setResults(games); setActive(-1); }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  const seeAll = () => {
    if (!term) return;
    navigate(`/explore?q=${encodeURIComponent(term)}`);
    close();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const game = shown[active];
    if (game) {
      navigate(`/game/${game.id}`);
      close();
    } else {
      seeAll();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      close();
      toggleRef.current?.focus();
    } else if (e.key === "ArrowDown" && shown.length > 0) {
      e.preventDefault();
      setActive((i) => (i + 1) % shown.length);
    } else if (e.key === "ArrowUp" && shown.length > 0) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? shown.length - 1 : i - 1));
    }
  };

  return (
    <>
      {logging && (
        <LogGameModal
          game={logging}
          onClose={() => setLogging(null)}
          onSave={async (status, rating, review, playtimeMin) => {
            await logGame(
              logging.id,
              status,
              rating ?? undefined,
              review ?? undefined,
              (logging.genres ?? []).map((g) => g.id),
              playtimeMin,
            );
            showToast(`Logged ${logging.name}`, { to: `/game/${logging.id}`, label: "View" });
            close();
          }}
        />
      )}

      {/* Collapsing field — full-width row of its own on mobile */}
      <div
        ref={wrapRef}
        style={{
          position: "relative",
          marginLeft: isMobile ? 0 : "auto",
          width: isMobile ? (open ? "100%" : 0) : (open ? 300 : 0),
          transition: "width var(--transition-slow)",
          ...(isMobile && open ? { order: 10, flexBasis: "100%" } : {}),
        }}
      >
        <form
          onSubmit={handleSubmit}
          role="search"
          style={{
            display: "flex",
            overflow: "hidden",
            opacity: open ? 1 : 0,
            transition: "opacity var(--transition-slow)",
          }}
        >
          <input
            ref={inputRef}
            className="field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search games"
            aria-label="Search games"
            role="combobox"
            aria-expanded={popoverOpen}
            aria-controls="nav-search-results"
            aria-autocomplete="list"
            autoComplete="off"
            tabIndex={open ? 0 : -1}
            // The focus ring is drawn inside so the collapsing form can't clip it
            style={{ width: "100%", padding: "0.5rem 0.9rem", margin: 3 }}
          />
        </form>

        {popoverOpen && (
          <div id="nav-search-results" className="search-pop reveal-pop" role="listbox" style={{ animationDuration: "160ms" }}>
            {loading && results === null ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "1rem" }}>
                <Spinner size={20} />
              </div>
            ) : shown.length === 0 ? (
              <p style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
                No games called &ldquo;{term}&rdquo;. Check the spelling, or try fewer words.
              </p>
            ) : (
              <>
                {shown.map((game, i) => {
                  const year = game.first_release_date
                    ? new Date(game.first_release_date * 1000).getFullYear()
                    : null;
                  return (
                    <div key={game.id} className="search-row" role="option" aria-selected={i === active} data-active={i === active}>
                      <Link to={`/game/${game.id}`} onMouseEnter={() => setActive(i)}>
                        <span style={{ width: 34, flexShrink: 0 }}>
                          <GameCover name={game.name} imageId={game.cover?.image_id} size="thumb" rounding="sm" />
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span
                            style={{
                              display: "block",
                              fontFamily: "var(--font-display)",
                              fontWeight: 700,
                              fontSize: "var(--text-sm)",
                              lineHeight: 1.25,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {game.name}
                          </span>
                          {year && (
                            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                              {year}
                            </span>
                          )}
                        </span>
                      </Link>
                      {canLog && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Log ${game.name}`}
                          onClick={() => setLogging(game)}
                          style={{ width: 36, height: 36, marginRight: 4 }}
                        >
                          <PlusIcon size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
                <button type="button" className="search-all" onClick={seeAll}>
                  See all results for &ldquo;{term}&rdquo;
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <button
        ref={toggleRef}
        type="button"
        className="icon-btn"
        aria-label={open ? "Close search" : "Search"}
        onClick={() => (open ? close() : setOpen(true))}
        style={{ marginLeft: isMobile ? "auto" : 0 }}
      >
        {open ? <CloseIcon size={18} /> : <SearchIcon size={18} />}
      </button>
    </>
  );
}
