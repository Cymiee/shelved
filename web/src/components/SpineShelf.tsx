import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCoverUrl } from "@gameboxd/lib";
import GameCover from "./GameCover";
import RatingSticker from "./Sticker";
import { formatPlaytime } from "../lib/format";

export interface SpineItem {
  /** IGDB game id. */
  id: number;
  name: string;
  imageId?: string | undefined;
  rating?: number | null | undefined;
  playtimeMin?: number | null | undefined;
}

interface Props {
  items: SpineItem[];
  /** Height of the tallest spine, in px. */
  height?: number;
  /** One row only, holding as many spines as fit. Default wraps onto more shelves. */
  singleRow?: boolean;
  /** Slide the spines onto the shelf one after another on mount. */
  animateIn?: boolean;
  /** Multiplier on spine thickness and type, for display shelves with few, large cases. */
  scale?: number;
}

const canHover = window.matchMedia("(hover: hover)").matches;

const SPINE_GAP = 3;
/** Half the width of a pulled-out case: how close to an edge a spine can be before the case must shift inward. */
const PULL_HALF = 80;

/** Stable pseudo-random number per game, so a game's spine always looks the same. */
function hash(id: number): number {
  return Math.imul(id, 2654435761) >>> 0;
}

function spineWidth(id: number, scale: number): number {
  return Math.round((34 + (hash(id) % 15)) * scale);
}

/**
 * Games as case spines standing on a shelf. Each spine is coloured by its own
 * cover art (enlarged and blurred), so the row looks like that person's
 * collection and nobody else's.
 *
 * Pointing at a spine pulls the case out to face you. With a mouse that is
 * hover, and a click opens the game. On touch the first tap pulls the case
 * out and a second tap (on the spine or the case) opens it.
 */
export default function SpineShelf({ items, height = 196, singleRow = false, animateIn = false, scale = 1 }: Props) {
  const navigate = useNavigate();
  const rowRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<{ id: number; edge: "left" | "right" | null } | null>(null);
  const [fit, setFit] = useState(items.length);

  // Single-row shelves show only whole spines: measure and keep what fits.
  useLayoutEffect(() => {
    if (!singleRow) return;
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      let used = 0;
      let count = 0;
      for (const item of items) {
        const next = used + spineWidth(item.id, scale) + (count > 0 ? SPINE_GAP : 0);
        if (next > row.clientWidth) break;
        used = next;
        count++;
      }
      setFit(count);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [singleRow, items, scale]);

  // Touch: tapping anywhere else puts the case back.
  useEffect(() => {
    if (!open || canHover) return;
    const onDown = (e: PointerEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const pull = (id: number, el: HTMLElement) => {
    const row = rowRef.current?.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const mid = rect.left + rect.width / 2;
    const edge = !row ? null : mid - row.left < PULL_HALF ? "left" : row.right - mid < PULL_HALF ? "right" : null;
    setOpen({ id, edge });
  };

  const visible = singleRow ? items.slice(0, fit) : items;

  return (
    <div
      ref={rowRef}
      className={`spine-row${singleRow ? " spine-row--single" : ""}`}
      // When there are more games than fit, spread the ones shown across the
      // whole board instead of leaving a gap at the end.
      {...(singleRow && fit < items.length ? { "data-full": true } : {})}
      onMouseLeave={() => { if (canHover) setOpen(null); }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(null);
      }}
    >
      {visible.map((item, i) => {
        const h = hash(item.id);
        const isOpen = open?.id === item.id;
        // Cases come in slightly different heights, like a real mixed shelf.
        const spineHeight = Math.round(height * (0.88 + ((h >>> 4) % 4) * 0.04));

        return (
          <div
            key={item.id}
            className={`spine-slot on-plank${animateIn ? " shelve-in" : ""}`}
            data-open={isOpen}
            {...(isOpen && open.edge ? { "data-edge": open.edge } : {})}
            style={{
              ["--spine-w" as string]: `${spineWidth(item.id, scale)}px`,
              ["--spine-font" as string]: `${(0.875 * Math.min(scale, 1.3)).toFixed(3)}rem`,
              ["--spine-h" as string]: `${spineHeight}px`,
              ...(animateIn
                ? { ["--d" as string]: `${120 + i * 38}ms`, ["--lean" as string]: `${(h % 2 === 0 ? -1 : 1) * 6}deg` }
                : {}),
            }}
          >
            <button
              type="button"
              className="spine"
              title={item.name}
              aria-label={item.rating != null ? `${item.name}, rated ${item.rating} out of 10` : item.name}
              onMouseEnter={(e) => { if (canHover) pull(item.id, e.currentTarget); }}
              onFocus={(e) => { if (canHover) pull(item.id, e.currentTarget); }}
              onClick={(e) => {
                if (canHover || isOpen) navigate(`/game/${item.id}`);
                else pull(item.id, e.currentTarget);
              }}
            >
              {item.imageId && (
                <img className="spine-art" src={getCoverUrl(item.imageId, "thumb")} alt="" loading="lazy" />
              )}
              {item.rating != null && <span className="sticker spine-dot" aria-hidden>{item.rating}</span>}
              <span className="spine-title">{item.name}</span>
            </button>

            {isOpen && (
              <Link
                to={`/game/${item.id}`}
                className="spine-pull"
                tabIndex={-1}
                {...(canHover ? { "aria-hidden": true } : {})}
              >
                <GameCover
                  name={item.name}
                  imageId={item.imageId}
                  {...(item.rating != null
                    ? {
                        badge: (
                          <RatingSticker
                            rating={item.rating}
                            size={36}
                            tilt={10}
                            slap
                            style={{ position: "absolute", top: -10, right: -10 }}
                          />
                        ),
                      }
                    : {})}
                >
                  {item.playtimeMin != null && item.playtimeMin > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        left: 6,
                        bottom: 6,
                        padding: "1px 7px",
                        borderRadius: 4,
                        background: "rgba(4, 7, 26, 0.82)",
                        color: "#fff",
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatPlaytime(item.playtimeMin)}
                    </span>
                  )}
                </GameCover>
                <span className="spine-pull-hint">Open game</span>
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
