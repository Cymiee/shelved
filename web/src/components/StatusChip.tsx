import type { GameStatus } from "@gameboxd/lib";
import { STATUS_META, color as themeColor, font } from "../theme";

interface Props {
  status: GameStatus;
  size?: "sm" | "md";
}

/**
 * A game's status as a small printed label: solid sticker ink with dark type,
 * so it reads the same on the navy wall and on a paper card.
 */
export default function StatusChip({ status, size = "md" }: Props) {
  const meta = STATUS_META[status];
  const pulse = status === "playing";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: size === "sm" ? "1px 7px" : "2px 9px",
        borderRadius: 4,
        background: meta.color,
        color: themeColor.ink,
        fontFamily: font.display,
        fontStretch: "84%",
        fontSize: size === "sm" ? "0.6875rem" : "var(--text-xs)",
        fontWeight: 800,
        lineHeight: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      {pulse && (
        <span
          aria-hidden
          className="pulse-dot"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: themeColor.ink,
            flexShrink: 0,
            ["--pulse-color" as string]: "rgba(22, 27, 61, 0.5)",
          }}
        />
      )}
      {meta.label}
    </span>
  );
}
