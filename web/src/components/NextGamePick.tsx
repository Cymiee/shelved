import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { IGDBGame } from "@gameboxd/lib";
import GameCover from "./GameCover";
import { CloseIcon } from "./icons";
import { useIsMobile } from "../hooks/useIsMobile";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** How many covers flick past before the picker settles, and how fast. */
const SHUFFLE_TICKS = 9;
const SHUFFLE_MS = 85;

/**
 * "What do I play next?" — draws one game at random from a pool. With enough
 * games to choose from it flicks through a few covers before settling, like
 * riffling along the shelf.
 */
export function useNextGamePick(pool: IGDBGame[]) {
  const [pick, setPick] = useState<IGDBGame | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => stop, []);

  const pickNext = () => {
    if (pool.length === 0) return;
    const draw = () => pool[Math.floor(Math.random() * pool.length)] ?? null;

    stop();
    if (reducedMotion || pool.length < 3) {
      setShuffling(false);
      setPick(draw());
      return;
    }
    setShuffling(true);
    let ticks = 0;
    timer.current = setInterval(() => {
      ticks++;
      setPick(draw());
      if (ticks >= SHUFFLE_TICKS) {
        stop();
        setShuffling(false);
      }
    }, SHUFFLE_MS);
  };

  const clear = () => {
    stop();
    setShuffling(false);
    setPick(null);
  };

  return { pick, shuffling, pickNext, clear };
}

interface PanelProps {
  pick: IGDBGame;
  shuffling: boolean;
  /** One line on where the pick came from, e.g. "From your wishlist". */
  source: string;
  /** Offer "Pick another" (pointless when the pool has one game). */
  canRepick: boolean;
  onRepick: () => void;
  onDismiss: () => void;
  /** An extra action shown first, e.g. "Start playing" on the wishlist. */
  primaryAction?: React.ReactNode;
}

/** The picker's answer: the chosen case, and what to do with it. */
export function NextGamePickPanel({ pick, shuffling, source, canRepick, onRepick, onDismiss, primaryAction }: PanelProps) {
  const isMobile = useIsMobile();

  return (
    <section
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
        marginBottom: "var(--space-7)",
        padding: "var(--space-4)",
        background: "var(--bg-card)",
        border: "1.5px solid var(--accent)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-lift)",
      }}
    >
      <div style={{ width: isMobile ? 84 : 104, flexShrink: 0 }}>
        <GameCover name={pick.name} imageId={pick.cover?.image_id} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="label">{shuffling ? "Looking along the shelf…" : "Play this next"}</p>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-2xl)",
            fontWeight: 900,
            lineHeight: 1.1,
            margin: "2px 0 4px",
            overflowWrap: "anywhere",
          }}
        >
          {pick.name}
        </h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{source}</p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-3)",
            marginTop: "var(--space-3)",
            // While covers are still flicking past, the actions would land on the wrong game
            ...(shuffling ? { pointerEvents: "none", opacity: 0.6 } : {}),
          }}
        >
          {primaryAction}
          <Link className={primaryAction ? "btn-key btn-key--wall" : "btn-key"} to={`/game/${pick.id}`}>
            Open game
          </Link>
          {canRepick && (
            <button type="button" className="btn-key btn-key--wall" onClick={onRepick} disabled={shuffling}>
              Pick another
            </button>
          )}
        </div>
      </div>
      <button
        type="button"
        className="icon-btn"
        aria-label="Dismiss pick"
        onClick={onDismiss}
        style={{ alignSelf: "flex-start" }}
      >
        <CloseIcon size={16} />
      </button>
    </section>
  );
}
