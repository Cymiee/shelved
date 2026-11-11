import { useRef, useState } from "react";
import type { CoverSize } from "@gameboxd/lib";
import { getCoverUrl } from "@gameboxd/lib";
import { color, font } from "../theme";

interface Props {
  name: string;
  /** IGDB cover image id. Omit/undefined renders the fallback tile. */
  imageId?: string | undefined;
  size?: CoverSize;
  /** Lets the case be "picked up": it tilts toward the pointer on hover. */
  interactive?: boolean;
  /** Corner rounding. Cards use "lg"; small inline thumbs use "sm". */
  rounding?: "sm" | "md" | "lg";
  /** Rendered on top of the art and clipped to the case, e.g. overlays. */
  children?: React.ReactNode;
  /** Rendered on top and NOT clipped, so it can overhang a corner, e.g. a rating sticker. */
  badge?: React.ReactNode;
  onClick?: (() => void) | undefined;
}

const canHover = window.matchMedia("(hover: hover)").matches;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The single cover-art primitive. IGDB art is inconsistent — missing covers,
 * landscape key art, odd ratios — so every cover in the app goes through here
 * to guarantee a fixed 3:4 case and a branded fallback instead of a broken
 * image or a squished one.
 */
export default function GameCover({
  name,
  imageId,
  size = "cover_big",
  interactive = false,
  rounding = "lg",
  children,
  badge,
  onClick,
}: Props) {
  const [failed, setFailed] = useState(false);
  const [lifted, setLifted] = useState(false);
  const glareRef = useRef<HTMLDivElement>(null);

  const showFallback = !imageId || failed;
  const corner = rounding === "sm" ? "var(--radius-case-sm)" : "var(--radius-case)";
  const tilts = interactive && canHover && !reducedMotion;

  // The tilt follows the pointer, so it is written straight to the element
  // rather than through state: a re-render per mousemove would be wasteful.
  // `transform` is deliberately absent from the style prop below so React
  // never resets it.
  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    el.style.transform =
      `perspective(700px) rotateY(${((px - 0.5) * 16).toFixed(2)}deg) rotateX(${((0.5 - py) * 12).toFixed(2)}deg) translateY(-8px) scale(1.03)`;
    if (glareRef.current) {
      glareRef.current.style.background =
        `radial-gradient(circle at ${(px * 100).toFixed(0)}% ${(py * 100).toFixed(0)}%, rgba(255,255,255,0.3), transparent 58%)`;
    }
  };

  const handleLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = "";
    if (glareRef.current) glareRef.current.style.background = "none";
    setLifted(false);
  };

  return (
    <div
      onClick={onClick}
      {...(onClick
        ? {
            role: "button",
            tabIndex: 0,
            "aria-label": name,
            className: "press",
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            },
          }
        : {})}
      {...(tilts
        ? {
            onMouseEnter: () => setLifted(true),
            onMouseMove: handleMove,
            onMouseLeave: handleLeave,
          }
        : {})}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "3 / 4",
        cursor: onClick ? "pointer" : "default",
        transition: "transform 0.16s var(--ease-out)",
        zIndex: lifted ? 5 : "auto",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: corner,
          overflow: "hidden",
          background: color.bgCard,
          boxShadow: lifted ? "0 26px 30px -12px rgba(4, 7, 26, 0.85)" : "var(--shadow-card)",
          transition: "box-shadow var(--transition-slow)",
        }}
      >
        {showFallback ? (
          <FallbackTile name={name} />
        ) : (
          <img
            src={getCoverUrl(imageId, size)}
            alt={name}
            loading="lazy"
            onError={() => setFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )}

        {/* The hinge edge of a plastic case: a hairline of light, then a soft groove. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(to right, rgba(255,255,255,0.22) 0, rgba(255,255,255,0) 2px, rgba(4,7,26,0.22) 3px, rgba(4,7,26,0) 8px)",
          }}
        />
        {tilts && (
          <div ref={glareRef} aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
        )}
        {children}
      </div>
      {badge}
    </div>
  );
}

/** Stand-in for missing/broken art: a blank case with the title on it. */
function FallbackTile({ name }: { name: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3)",
        background: `linear-gradient(160deg, var(--border), ${color.bgCard})`,
        textAlign: "center",
      }}
    >
      <SpineMark />
      <span
        style={{
          fontFamily: font.display,
          fontStretch: "76%",
          fontSize: "var(--text-sm)",
          fontWeight: 800,
          lineHeight: 1.15,
          color: color.textSecondary,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          overflowWrap: "anywhere",
        }}
      >
        {name}
      </span>
    </div>
  );
}

/** Three spines, one leaning — the Shelved mark. */
function SpineMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="4.5" height="16" rx="1.2" fill="var(--accent)" />
      <rect x="9.75" y="4" width="4.5" height="16" rx="1.2" fill="var(--sticker-pink)" />
      <rect
        x="16.5"
        y="5.5"
        width="4.5"
        height="16"
        rx="1.2"
        fill="var(--sticker-sky)"
        transform="rotate(-9 16.5 5.5)"
      />
    </svg>
  );
}
