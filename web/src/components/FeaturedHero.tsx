import { useState } from "react";
import { Link } from "react-router-dom";
import type { IGDBGame } from "@gameboxd/lib";
import { useIsMobile } from "../hooks/useIsMobile";
import { font, space } from "../theme";

interface Props {
  game: IGDBGame;
  /** Secondary CTA label (differs by auth state). */
  secondaryLabel: string;
  /** Shown in place of the label once the secondary action has run. */
  secondaryDoneLabel?: string;
  /**
   * Logged-in: an action (e.g. add to wishlist). Mutually exclusive with
   * secondaryTo. Reject to signal failure; the button then stays available.
   */
  onSecondary?: () => Promise<void>;
  /** Logged-out: a link target (e.g. /auth). Mutually exclusive with onSecondary. */
  secondaryTo?: string;
}

/** First sentence of a summary, trimmed to a tagline length. */
function tagline(summary: string | null): string | null {
  if (!summary) return null;
  const first = summary.split(/(?<=[.!?])\s/)[0] ?? summary;
  return first.length > 160 ? `${first.slice(0, 157).trimEnd()}…` : first;
}

/**
 * The shop window: the top trending game as one large framed display,
 * with a sticker saying why it's there. It sits inside the page column rather
 * than taking over the top of the screen, so it never pushes people's own
 * content below the fold.
 */
export default function FeaturedHero({ game, secondaryLabel, secondaryDoneLabel, onSecondary, secondaryTo }: Props) {
  const isMobile = useIsMobile();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const runSecondary = async () => {
    if (!onSecondary) return;
    setBusy(true);
    try {
      await onSecondary();
      setDone(true);
    } catch {
      // The caller reports the failure; leave the button ready for another try.
    } finally {
      setBusy(false);
    }
  };

  const artId = game.artworks?.[0]?.image_id ?? game.screenshots?.[0]?.image_id ?? game.cover?.image_id;
  const bg = artId ? `https://images.igdb.com/igdb/image/upload/t_1080p/${artId}.jpg` : null;
  const line = tagline(game.summary);

  const secondaryStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.6rem 1.15rem",
    borderRadius: "var(--radius-md)",
    fontFamily: font.display,
    fontWeight: 800,
    fontSize: "var(--text-sm)",
    textDecoration: "none",
  };

  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-end",
        minHeight: isMobile ? 340 : 420,
        marginBottom: space[7],
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-card)",
        boxShadow: "0 0 0 1.5px var(--border-strong), var(--shadow-lift)",
      }}
    >
      {bg && (
        <img
          src={bg}
          alt=""
          aria-hidden
          loading="lazy"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}

      {/* Scrims in the wall colour, so type stays readable over any artwork */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, color-mix(in srgb, var(--bg-base) 94%, transparent) 0%, color-mix(in srgb, var(--bg-base) 55%, transparent) 42%, transparent 78%), " +
            "linear-gradient(to right, color-mix(in srgb, var(--bg-base) 70%, transparent) 0%, transparent 62%)",
        }}
      />

      {/* Why this game is in the window */}
      <span
        style={{
          position: "absolute",
          top: space[4],
          left: space[4],
          padding: "3px 11px",
          background: "var(--accent)",
          color: "var(--on-accent)",
          borderRadius: "var(--radius-sm)",
          boxShadow: "0 3px 0 var(--accent-edge)",
          fontFamily: font.display,
          fontWeight: 800,
          fontSize: "var(--text-sm)",
          transform: "rotate(-3deg)",
        }}
      >
        Trending now
      </span>

      <div style={{ position: "relative", width: "100%", padding: isMobile ? space[4] : space[6] }}>
        <h2
          style={{
            fontFamily: font.display,
            fontStretch: "92%",
            fontSize: "clamp(1.9rem, 4.6vw, 3.5rem)",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            color: "#fff",
            margin: 0,
            maxWidth: "18ch",
            textWrap: "balance",
          }}
        >
          {game.name}
        </h2>
        {line && (
          <p
            style={{
              marginTop: space[3],
              fontSize: "var(--text-base)",
              color: "var(--text-primary)",
              lineHeight: 1.5,
              maxWidth: "52ch",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {line}
          </p>
        )}
        <div style={{ marginTop: space[4], display: "flex", gap: space[3], flexWrap: "wrap" }}>
          <Link className="btn-key" to={`/game/${game.id}`}>View game</Link>

          {secondaryTo ? (
            <Link className="btn-ghost-light" to={secondaryTo} style={secondaryStyle}>
              {secondaryLabel}
            </Link>
          ) : (
            <button
              type="button"
              className="btn-ghost-light"
              disabled={done || busy}
              onClick={() => { void runSecondary(); }}
              style={{ ...secondaryStyle, cursor: done || busy ? "default" : "pointer" }}
            >
              {done ? (secondaryDoneLabel ?? secondaryLabel) : secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
