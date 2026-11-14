import { useState } from "react";
import type { TopGameRow, IGDBGame } from "@gameboxd/lib";
import GameCover from "../GameCover";
import { CloseIcon } from "../icons";

type Slot = 1 | 2 | 3;

interface FavouritesPickerProps {
  isOwn: boolean;
  topGames: TopGameRow[];
  gameData: Map<number, IGDBGame>;
  assigningSlot: Slot | null;
  search: string;
  results: IGDBGame[];
  searching: boolean;
  onOpenGame: (gameId: number) => void;
  onStartAssign: (slot: Slot) => void;
  onCancelAssign: () => void;
  onRemove: (slot: Slot) => void;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onPick: (game: IGDBGame) => void;
}

const SLOTS = [1, 2, 3] as const;

export default function FavouritesPicker({
  isOwn, topGames, gameData, assigningSlot, search, results, searching,
  onOpenGame, onStartAssign, onCancelAssign, onRemove, onSearchChange, onSearchSubmit, onPick,
}: FavouritesPickerProps) {
  const [hovered, setHovered] = useState<Slot | null>(null);
  // Touch screens have no hover, so the remove control stays visible there.
  const [noHover] = useState(() => window.matchMedia("(hover: none)").matches);

  return (
    <>
      <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        {SLOTS.map((pos) => {
          const entry = topGames.find((g) => g.position === pos);
          const game = entry ? gameData.get(entry.game_igdb_id) : null;
          const showControls = isOwn && hovered === pos;

          return (
            <div
              key={pos}
              style={{ flex: 1, position: "relative", minWidth: 0 }}
              onMouseEnter={() => setHovered(pos)}
              onMouseLeave={() => setHovered(null)}
            >
              {game ? (
                <GameCover
                  name={game.name}
                  imageId={game.cover?.image_id}
                  rounding="md"
                  interactive
                  onClick={() => onOpenGame(game.id)}
                >
                  {/* Position number: editorial index mark */}
                  <span
                    style={{
                      position: "absolute",
                      bottom: 4,
                      left: 7,
                      fontFamily: "var(--font-display)",
                      fontSize: "1.75rem",
                      fontWeight: 600,
                      color: "rgba(245, 243, 240, 0.28)",
                      lineHeight: 1,
                      pointerEvents: "none",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {`0${pos}`}
                  </span>

                  {isOwn && (showControls || noHover) && (
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(pos);
                      }}
                      aria-label={`Remove ${game.name} from favourites`}
                      style={{
                        position: "absolute",
                        top: 5,
                        right: 5,
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        border: "none",
                        background: "rgba(0,0,0,0.78)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <CloseIcon size={14} />
                    </button>
                  )}
                  {showControls && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: "linear-gradient(to top, rgba(0,0,0,0.92), transparent)",
                        padding: "1.5rem 0.5rem 0.5rem",
                        pointerEvents: "none",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          fontWeight: 600,
                          fontFamily: "var(--font-display)",
                          color: "var(--text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {game.name}
                      </div>
                    </div>
                  )}
                </GameCover>
              ) : (
                <button
                  type="button"
                  disabled={!isOwn}
                  aria-label={`Add a favourite in slot ${pos}`}
                  onClick={() => onStartAssign(pos)}
                  style={{
                    width: "100%",
                    aspectRatio: "3 / 4",
                    background: "var(--bg-inset)",
                    border: "1px dashed var(--border-strong)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                    cursor: isOwn ? "pointer" : "default",
                    gap: "var(--space-1)",
                    fontSize: "var(--text-xs)",
                    fontFamily: "inherit",
                    transition: "border-color var(--transition), color var(--transition)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isOwn) return;
                    e.currentTarget.style.borderColor = "var(--accent-ring)";
                    e.currentTarget.style.color = "var(--accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-strong)";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  {isOwn ? (
                    <>
                      <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>+</span>
                      <span>Add</span>
                    </>
                  ) : (
                    <span style={{ fontSize: "1rem" }}>—</span>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {assigningSlot && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--accent)",
            borderRadius: "var(--radius-sm)",
            padding: "0.75rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>Slot #{assigningSlot}</span>
            <button type="button" className="icon-btn" onClick={onCancelAssign} aria-label="Close search" style={{ width: 32, height: 32 }}>
              <CloseIcon size={16} />
            </button>
          </div>
          <form onSubmit={onSearchSubmit} style={{ display: "flex", gap: "0.4rem", marginBottom: "0.6rem" }}>
            <input
              className="field"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search game..."
              aria-label="Search for a game"
              style={{ flex: 1, minWidth: 0, padding: "0.4rem 0.7rem" }}
            />
            <button type="submit" className="btn-key btn-key--sm" disabled={searching}>
              {searching ? "..." : "Go"}
            </button>
          </form>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
            {results.map((g) => (
              <button
                key={g.id}
                type="button"
                className="btn-key btn-key--wall btn-key--sm"
                onClick={() => onPick(g)}
                style={{ justifyContent: "flex-start", textAlign: "left", whiteSpace: "normal" }}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
