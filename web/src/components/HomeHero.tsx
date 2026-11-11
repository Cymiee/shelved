import { Link } from "react-router-dom";
import type { IGDBGame } from "@gameboxd/lib";
import SpineShelf from "./SpineShelf";
import { useIsMobile } from "../hooks/useIsMobile";
import { color, font, space } from "../theme";

interface Props {
  /** Popular games to stand on the demo shelf. */
  games: IGDBGame[];
}

const canHover = window.matchMedia("(hover: hover)").matches;

/**
 * What a signed-out visitor sees first: one line saying what Shelved is, and
 * a real shelf of popular games they can pull cases out of. The shelf is the
 * product, so it is the hero rather than a screenshot or a slogan.
 */
export default function HomeHero({ games }: Props) {
  const isMobile = useIsMobile();
  const shelfHeight = isMobile ? 200 : 264;

  return (
    <section
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: isMobile ? "2.5rem 16px 0" : "3.5rem 24px 0",
      }}
    >
      <h1
        style={{
          fontFamily: font.display,
          fontStretch: "106%",
          fontWeight: 900,
          fontSize: "clamp(2.5rem, 7.4vw, 5.25rem)",
          lineHeight: 0.96,
          letterSpacing: "-0.035em",
          color: color.text,
          maxWidth: "13ch",
          textWrap: "balance",
        }}
      >
        Every game you&rsquo;ve played, on one shelf.
      </h1>

      <p
        style={{
          marginTop: space[5],
          maxWidth: "44ch",
          fontSize: isMobile ? "var(--text-base)" : "var(--text-lg)",
          lineHeight: 1.55,
          color: color.textSecondary,
        }}
      >
        Log what you play, rate it out of ten, and see what your friends are into.
      </p>

      <div style={{ marginTop: space[5], display: "flex", flexWrap: "wrap", gap: space[3] }}>
        <Link className="btn-key btn-key--lg" to="/auth?mode=signup">Start your shelf</Link>
        <Link className="btn-key btn-key--wall btn-key--lg" to="/explore">Browse games</Link>
      </div>

      {/* The shelf. Height is reserved up front so nothing jumps when games load. */}
      <div style={{ marginTop: space[8], minHeight: shelfHeight + 11 }}>
        <SpineShelf
          singleRow
          animateIn
          height={shelfHeight}
          scale={isMobile ? 1 : 1.3}
          items={games.map((g) => ({ id: g.id, name: g.name, imageId: g.cover?.image_id }))}
        />
      </div>
      <p style={{ marginTop: space[3], fontSize: "var(--text-sm)", color: color.textMuted }}>
        Popular right now. {canHover ? "Point at a spine to pull it out." : "Tap a spine to pull it out."}
      </p>
    </section>
  );
}
