interface Props {
  /** Rating out of 10. */
  rating: number;
  /** Diameter in px. */
  size?: number;
  /** Rotation in degrees. Stickers are never applied straight. */
  tilt?: number;
  /** Play the slap-on animation. Use when the sticker appears because of something the person just did. */
  slap?: boolean;
  /** Positioning overrides, e.g. pinning it to a cover's corner. */
  style?: React.CSSProperties | undefined;
  className?: string | undefined;
}

/** Starburst outline for perfect scores: 14 points, alternating radii. */
const BURST = (() => {
  const points: string[] = [];
  const spikes = 14;
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? 50 : 42;
    const angle = (Math.PI * i) / spikes;
    points.push(`${(50 + radius * Math.sin(angle)).toFixed(1)}% ${(50 - radius * Math.cos(angle)).toFixed(1)}%`);
  }
  return `polygon(${points.join(",")})`;
})();

/**
 * A rating as a price-gun sticker: a fluoro dot stuck on at an angle.
 * A 10 gets the pink starburst instead, because a perfect score should look
 * different from a 9 at a glance.
 */
export default function RatingSticker({ rating, size = 34, tilt = -8, slap = false, style, className }: Props) {
  const perfect = rating === 10;
  const tiltVar = { ["--tilt" as string]: `${tilt}deg` };
  const label = `Rated ${rating} out of 10`;
  const extra = className ? ` ${className}` : "";

  if (perfect) {
    const burst = Math.round(size * 1.22);
    return (
      <span
        className={`sticker-burst-wrap${slap ? " sticker--slap" : ""}${extra}`}
        role="img"
        aria-label={label}
        style={{ ...tiltVar, ...style }}
      >
        <span
          className="sticker sticker--burst"
          style={{ width: burst, height: burst, fontSize: burst * 0.4, clipPath: BURST }}
        >
          10
        </span>
      </span>
    );
  }

  return (
    <span
      className={`sticker${slap ? " sticker--slap" : ""}${extra}`}
      role="img"
      aria-label={label}
      style={{ width: size, height: size, fontSize: size * 0.5, ...tiltVar, ...style }}
    >
      {rating}
    </span>
  );
}
