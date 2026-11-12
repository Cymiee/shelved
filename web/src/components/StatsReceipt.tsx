import { useState } from "react";
import type { ShelfStats } from "../lib/stats";
import { formatPlaytime } from "../lib/format";
import { color, font } from "../theme";

interface Props {
  username: string;
  stats: ShelfStats;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const HISTOGRAM_BAR_MAX = 72;

/** Totals run into the thousands of hours, so they get separators; short spans keep the compact form. */
const hours = (minutes: number) =>
  minutes >= 600 ? `${Math.round(minutes / 60).toLocaleString()}h` : formatPlaytime(minutes);

/**
 * A shelf's totals as a till receipt: line items with dotted leaders, a
 * histogram of ratings and the top genres. Paper is the house material for
 * anything that belongs to a person, and a receipt is the shop's own way of
 * adding things up.
 */
export default function StatsReceipt({ username, stats }: Props) {
  const { byStatus } = stats;

  return (
    <div className="receipt-wrap">
      <article className="receipt" aria-label={`Shelf stats for ${username}`}>
        <header style={{ textAlign: "center" }}>
          <div className="wordmark" aria-hidden>
            <span style={{ fontSize: "1rem" }}>Shelved</span>
          </div>
          <h2
            style={{
              marginTop: 14,
              fontFamily: font.display,
              fontStretch: "92%",
              fontWeight: 900,
              fontSize: "var(--text-xl)",
              lineHeight: 1.15,
              overflowWrap: "anywhere",
            }}
          >
            Receipt for {username}
          </h2>
          <p style={{ fontSize: "var(--text-xs)", color: color.inkSoft }}>{dateFormat.format(new Date())}</p>
        </header>

        <hr className="receipt-rule" />

        <Line label="On the shelf" value={stats.onShelf} strong />
        <Line label="Completed" value={byStatus.completed} indent />
        <Line label="Played" value={byStatus.played} indent />
        <Line label="Playing" value={byStatus.playing} indent />
        <Line label="Dropped" value={byStatus.dropped} indent />
        <Line label="On the wishlist" value={byStatus.want_to_play} />

        <hr className="receipt-rule" />

        <Line label="Time played" value={stats.minutes > 0 ? hours(stats.minutes) : "none logged"} />
        <Line label="Reviews written" value={stats.reviews} />
        <Line
          label="Average rating"
          value={stats.average != null ? `${stats.average.toFixed(1)} / 10` : "nothing rated"}
          strong
        />

        {stats.rated > 0 && (
          <>
            <hr className="receipt-rule" />
            <RatingHistogram spread={stats.ratingSpread} />
          </>
        )}

        {stats.topGenres.length > 0 && (
          <>
            <hr className="receipt-rule" />
            <SectionTitle>Top genres</SectionTitle>
            <GenreBars stats={stats} />
          </>
        )}

        <hr className="receipt-rule" />

        <footer style={{ textAlign: "center" }}>
          <p style={{ fontFamily: font.display, fontWeight: 800, fontSize: "var(--text-sm)" }}>
            {byStatus.dropped > 0 ? "No refunds on dropped games." : "Thanks for playing."}
          </p>
          <Barcode seed={username} />
        </footer>
      </article>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontFamily: font.display, fontWeight: 800, fontSize: "var(--text-sm)", marginBottom: 6 }}>
      {children}
    </h3>
  );
}

/** label ........ value */
function Line({ label, value, strong = false, indent = false }: { label: string; value: string | number; strong?: boolean; indent?: boolean }) {
  const Tag = strong ? "strong" : "span";
  return (
    <div className="receipt-line" style={{ paddingLeft: indent ? 14 : 0, color: indent ? color.inkSoft : color.ink, fontSize: indent ? "var(--text-sm)" : "var(--text-base)" }}>
      <Tag>{label}</Tag>
      <span className="leader" aria-hidden />
      <Tag>{value}</Tag>
    </div>
  );
}

/**
 * Games per rating, 1 to 10. One series, so one ink: bar height carries the
 * count. Only the tallest bar is labelled at rest; pointing at, focusing or
 * tapping any bar shows its count, and every bar carries the number for
 * screen readers.
 */
function RatingHistogram({ spread }: { spread: number[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...spread, 1);
  const peak = spread.indexOf(max);

  return (
    <section>
      <SectionTitle>How you rate</SectionTitle>
      <div
        role="list"
        aria-label="Number of games given each rating"
        onMouseLeave={() => setActive(null)}
        style={{ display: "grid", gridTemplateColumns: "repeat(10, minmax(0, 1fr))", gap: 4, alignItems: "end" }}
      >
        {spread.map((count, i) => {
          const rating = i + 1;
          const labelled = active === i || (active === null && i === peak);
          return (
            <div
              key={rating}
              role="listitem"
              tabIndex={0}
              aria-label={`Rated ${rating}: ${count} ${count === 1 ? "game" : "games"}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onClick={() => setActive((current) => (current === i ? null : i))}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "default", outlineOffset: 2 }}
            >
              <span
                aria-hidden
                style={{
                  height: 16,
                  fontSize: "0.6875rem",
                  fontWeight: 800,
                  lineHeight: "16px",
                  visibility: labelled ? "visible" : "hidden",
                }}
              >
                {count}
              </span>
              {/* Fixed-height plot area so every bar grows from the same baseline */}
              <span aria-hidden style={{ height: HISTOGRAM_BAR_MAX, width: "100%", display: "flex", alignItems: "flex-end" }}>
                <span
                  style={{
                    width: "100%",
                    height: count > 0 ? Math.max(3, Math.round((count / max) * HISTOGRAM_BAR_MAX)) : 0,
                    background: color.ink,
                    opacity: active === null || active === i ? 1 : 0.45,
                    borderRadius: "3px 3px 0 0",
                    transition: "opacity var(--transition)",
                  }}
                />
              </span>
              <span
                aria-hidden
                style={{
                  width: "100%",
                  paddingTop: 3,
                  borderTop: `2px solid ${color.ink}`,
                  textAlign: "center",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: color.inkSoft,
                }}
              >
                {rating}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GenreBars({ stats }: { stats: ShelfStats }) {
  const most = Math.max(...stats.topGenres.map((g) => g.games), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {stats.topGenres.map((genre) => (
        <div key={genre.name}>
          <div className="receipt-line" style={{ lineHeight: 1.5, fontSize: "var(--text-sm)" }}>
            <span>{genre.name}</span>
            <span className="leader" aria-hidden />
            <span>
              {genre.games} {genre.games === 1 ? "game" : "games"}
              {genre.minutes > 0 ? `, ${hours(genre.minutes)}` : ""}
            </span>
          </div>
          <div
            aria-hidden
            style={{
              height: 5,
              marginTop: 2,
              width: `${Math.max(4, (genre.games / most) * 100)}%`,
              background: color.ink,
              borderRadius: "0 3px 3px 0",
            }}
          />
        </div>
      ))}
    </div>
  );
}

/** Decorative barcode. The bar widths come from the username, so each person's is their own. */
function Barcode({ seed }: { seed: string }) {
  const widths = Array.from({ length: 34 }, (_, i) => 1 + ((seed.charCodeAt(i % Math.max(seed.length, 1)) || 7) * (i + 3)) % 4);
  return (
    <div aria-hidden style={{ display: "flex", justifyContent: "center", gap: 2, height: 38, marginTop: 12 }}>
      {widths.map((w, i) => (
        <span key={i} style={{ width: w, background: color.ink }} />
      ))}
    </div>
  );
}
