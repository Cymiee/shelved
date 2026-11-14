import { color, font, space } from "../theme";

interface ShelfProps {
  /** Shelf name, e.g. "Playing", "Trending now". */
  title: string;
  /** Item count shown beside the title. Omit to hide. */
  count?: number | undefined;
  /** Optional hue for the count sticker (status shelves pass their color). */
  accent?: string | undefined;
  /** Right-aligned slot for a link or control. */
  action?: React.ReactNode;
  /** "row" = horizontally scrollable; "grid" = wrapping grid. */
  layout?: "row" | "grid";
  /** Fixed track width for row items; grid uses this as its min column width. */
  itemWidth?: number;
  children: React.ReactNode;
}

/**
 * A shelf: a heading above a run of items. The plank itself is drawn by the
 * items (`.on-plank`, see index.css), so both the scrolling row and the
 * wrapping grid end up with a continuous board under every row.
 */
export default function Shelf({
  title,
  count,
  accent,
  action,
  layout = "row",
  itemWidth = 150,
  children,
}: ShelfProps) {
  return (
    <section style={{ marginBottom: space[7] }}>
      <ShelfHeader title={title} {...(count !== undefined ? { count } : {})} {...(accent ? { accent } : {})} action={action} />
      {layout === "row" ? (
        <div className="no-scrollbar" style={shelfRowStyle}>
          {Array.isArray(children)
            ? children.map((child, i) => (
                <div
                  key={i}
                  style={{
                    flex: `0 0 ${itemWidth}px`,
                    // Without this, a flex item's automatic minimum size is its
                    // min-content width — a long game title then overrides
                    // flex-basis and that one card renders wider than its siblings.
                    minWidth: 0,
                    scrollSnapAlign: "start",
                  }}
                >
                  {child}
                </div>
              ))
            : children}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${itemWidth}px), 1fr))`,
            gap: `${space[5]} ${space[4]}`,
          }}
        >
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * A scrolling row clips on both axes, so it is padded out (and pulled back
 * with matching negative margins) to leave room for a picked-up case, its
 * shadow and any sticker that overhangs a corner.
 */
export const shelfRowStyle: React.CSSProperties = {
  display: "flex",
  gap: space[4],
  overflowX: "auto",
  padding: "16px 10px 20px",
  margin: "-16px -10px -12px",
  scrollSnapType: "x proximity",
  scrollPaddingLeft: 10,
};

/** The shelf heading — reusable on its own for sections that aren't cover rows. */
export function ShelfHeader({
  title,
  count,
  accent,
  action,
}: {
  title: string;
  count?: number | undefined;
  accent?: string | undefined;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: space[3],
        marginBottom: space[4],
        minWidth: 0,
      }}
    >
      <h2
        style={{
          fontFamily: font.display,
          fontStretch: "96%",
          fontSize: "var(--text-xl)",
          fontWeight: 800,
          letterSpacing: "-0.01em",
          lineHeight: 1.15,
          color: color.text,
          margin: 0,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </h2>

      {/* The count, as a little label stuck beside the name */}
      {count !== undefined && (
        <span
          style={{
            flexShrink: 0,
            padding: "2px 9px",
            borderRadius: "var(--radius-full)",
            background: accent ?? color.accent,
            color: color.ink,
            fontFamily: font.display,
            fontStretch: "86%",
            fontSize: "var(--text-xs)",
            fontWeight: 800,
            lineHeight: 1.5,
            fontVariantNumeric: "tabular-nums",
            transform: "rotate(-4deg)",
            boxShadow: "0 2px 0 rgba(4, 7, 26, 0.45)",
          }}
        >
          {count}
        </span>
      )}

      <span aria-hidden style={{ flex: 1 }} />

      {action}
    </div>
  );
}

/**
 * Shown in place of a shelf whose request failed, so a failure never looks
 * like an empty shelf that quietly vanished.
 */
export function ShelfError({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <section style={{ marginBottom: space[7] }}>
      <ShelfHeader title={title} />
      <div
        style={{
          padding: space[4],
          border: `1.5px dashed ${color.borderStrong}`,
          borderRadius: "var(--radius-lg)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space[3],
        }}
      >
        <div role="alert" style={{ color: color.textSecondary, fontSize: "var(--text-sm)" }}>
          {message}
        </div>
        <button type="button" className="btn-key btn-key--wall btn-key--sm" onClick={onRetry}>
          Try again
        </button>
      </div>
    </section>
  );
}

/**
 * Placeholder shelf shown while a row of covers loads. Same header and cover
 * footprint as the real thing, so nothing shifts when the data lands.
 */
export function ShelfSkeleton({
  title,
  itemWidth = 150,
  count = 7,
}: {
  title: string;
  itemWidth?: number;
  count?: number;
}) {
  return (
    <section style={{ marginBottom: space[7] }} aria-busy="true" aria-label={`${title} loading`}>
      <ShelfHeader title={title} />
      <div className="no-scrollbar" style={{ ...shelfRowStyle, overflowX: "hidden" }}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} style={{ flex: `0 0 ${itemWidth}px`, minWidth: 0 }}>
            <div className="on-plank">
              <div
                style={{
                  width: "100%",
                  aspectRatio: "3 / 4",
                  borderRadius: "var(--radius-case)",
                  background: color.bgCard,
                  animation: "skeletonPulse 1.5s ease-in-out infinite",
                  animationDelay: `${i * 80}ms`,
                }}
              />
            </div>
            <div
              style={{
                height: 12,
                width: "70%",
                marginTop: space[3],
                borderRadius: 4,
                background: color.bgCard,
                animation: "skeletonPulse 1.5s ease-in-out infinite",
                animationDelay: `${i * 80}ms`,
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
